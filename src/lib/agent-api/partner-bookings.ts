import { createHash } from "node:crypto";
import { recordAuditInTransaction } from "./audit";
import type { z } from "zod";
import { db } from "../db";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./keys";
import type { agentBookingSchema } from "./bookings";
import { assertCurrentAgent, lockMandate } from "./mandates";
import { assertMandatedBooking } from "./mandate-policy";
import { placeForStaff } from "./place";
import { proposalHash } from "./proposals";
import { getBookingProvider } from "./provider";
import { AGENT_API_CHANNEL } from "../domain";

/** A durable attempt binds unknown outcomes to one mandate, key and payload.
 * Locks never span a network call. Slot conflicts release the reservation;
 * ambiguous failures retain it for an identical retry only. */
export async function createPartnerAgentBooking(p: AgentPrincipal, input: z.infer<typeof agentBookingSchema>, key: string) {
  const provider = getBookingProvider(p.businessId);
  const bodyHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const catalog = await provider.listServices();
  const service = catalog.services.find(s => s.id === input.serviceId);
  const staff = catalog.resources.find(s => s.id === input.staffId);
  if (!service) throw new AgentApiError("service_not_found");
  if (!staff?.serviceIds.includes(service.id)) throw new AgentApiError("staff_not_found");
  if (service.version !== input.serviceVersion) throw new AgentApiError("stale_service");
  const prior = await db.$transaction(async tx => {
    await assertCurrentAgent(tx, p);
    const mandate = await lockMandate(tx, input.mandateId!);
    // Serialize distinct keys for the same client too, avoiding unique-key races.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`partner:${p.clientId}`}, 0))`;
    const attempt = await tx.partnerBookingAttempt.findUnique({ where: { idempotencyKey: key } });
    if (attempt && (attempt.bodyHash !== bodyHash || attempt.mandateId !== input.mandateId ||
        attempt.clientId !== p.clientId || attempt.businessId !== p.businessId || attempt.providerId !== provider.id))
      throw new AgentApiError("idempotency_conflict");
    const link = await tx.agentBooking.findUnique({ where: { mandateId: input.mandateId! } });
    if (link && (!attempt || link.clientId !== p.clientId || link.businessId !== p.businessId))
      throw new AgentApiError("mandate_denied");
    if (link) return { link, proposalId: mandate?.origin === "customer-consent" ? mandate.originReference : undefined };
    // Before any new provider creation, validate current authority and consent.
    assertMandatedBooking(mandate, { businessId: p.businessId, clientId: p.clientId,
      serviceId: service.id, staffId: staff.id, ...placeForStaff(staff.id),
      start: new Date(input.start), duration: service.duration, priceOre: service.priceOre });
    if (mandate!.origin === "customer-consent") {
      const rows = await tx.$queryRaw<import("@prisma/client").AgentProposal[]>`SELECT * FROM "AgentProposal" WHERE "id"=${mandate!.originReference} FOR SHARE`;
      const proposal = rows[0];
      if (!proposal || proposal.clientId !== p.clientId || proposal.businessId !== p.businessId ||
          proposal.status !== "approved" || proposal.mandateId !== mandate!.id ||
          proposal.proposalHash !== mandate!.proposalHash || proposalHash(proposal) !== mandate!.proposalHash)
        throw new AgentApiError("mandate_denied");
    }
    if (!attempt) {
      if (await tx.partnerBookingAttempt.findUnique({ where: { mandateId: input.mandateId! } }))
        throw new AgentApiError("mandate_denied");
      await tx.partnerBookingAttempt.create({ data: { idempotencyKey: key, mandateId: input.mandateId!,
        businessId: p.businessId, clientId: p.clientId, providerId: provider.id, bodyHash } });
    }
    return { link, proposalId: mandate!.origin === "customer-consent" ? mandate!.originReference : undefined };
  });
  if (prior.link) return { replayed: true, booking: await provider.getBooking(prior.link.bookingId) };
  let booking;
  try {
    booking = await provider.createBooking({ serviceId: input.serviceId, serviceVersion: input.serviceVersion,
      staffId: input.staffId, start: input.start, customerName: input.customer.name,
      customerEmail: input.customer.email }, key, `${AGENT_API_CHANNEL}${p.clientId}`);
  } catch (error) {
    if (error instanceof AgentApiError && error.code === "slot_unavailable") {
      await db.$transaction(async tx => {
        await lockMandate(tx, input.mandateId!);
        // A successful concurrent identical retry must never lose its binding.
        if (!await tx.agentBooking.findUnique({ where: { mandateId: input.mandateId! } }))
          await tx.partnerBookingAttempt.deleteMany({ where: { idempotencyKey: key, bodyHash } });
      });
    }
    throw error;
  }
  const replayed = await db.$transaction(async tx => {
    await assertCurrentAgent(tx, p);
    await lockMandate(tx, input.mandateId!);
    const existing = await tx.agentBooking.findUnique({ where: { mandateId: input.mandateId! } });
    if (existing) {
      if (existing.bookingId !== booking.id || existing.clientId !== p.clientId) throw new AgentApiError("idempotency_conflict");
      return true;
    }
    await tx.agentBooking.create({ data: { bookingId: booking.id, keyId: p.keyId, businessId: p.businessId,
      clientId: p.clientId, mandateId: input.mandateId } });
    // Atomic link + audit; a database failure rolls both back and leaves the attempt.
    for (const event of ["mandate.consumed", "booking.created"] as const) await recordAuditInTransaction(tx, {
      businessId: "lab-partner", event, outcome: "booked", clientId: p.clientId, mandateId: input.mandateId,
      proposalId: prior.proposalId, bookingId: booking.id,
    });
    return false;
  });
  return { replayed, booking };
}
