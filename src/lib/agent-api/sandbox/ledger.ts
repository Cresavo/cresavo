import { randomUUID } from "node:crypto";
import type { AgentMandate, AgentProposal, Prisma, SandboxSession } from "@prisma/client";
import { z } from "zod";
import { AGENT_API_CHANNEL, createSandboxBooking } from "../../domain";
import { agentBookingSchema, projectAgentBooking, scopedIdempotencyKey } from "../bookings";
import { AgentApiError } from "../errors";
import { assertMandatedBooking, bookingProposalHash } from "../mandate-policy";
import { placeForStaff } from "../place";
import { proposalHash, proposalSchema, proposalView } from "../proposals";
import { API_VERSION, Created } from "../v1";
import { MAX_SANDBOX_BOOKINGS, SANDBOX_CHANNEL, SANDBOX_CUSTOMER } from "./config";
import { sandboxNow, type SandboxAgent } from "./store";

export const SANDBOX_BUSINESS = "demo";
const MAX_PROPOSALS = 20;
const CONSENT_MS = 600_000;
const scopedBooking = agentBookingSchema.extend({ customer: z.unknown().optional() });

export function requireSandboxBusiness(business: unknown) {
  if (typeof business !== "string" || !business) throw new AgentApiError("invalid_request");
  if (business !== SANDBOX_BUSINESS) throw new AgentApiError("forbidden_business");
}

async function currentTerms(tx: Prisma.TransactionClient, session: SandboxSession, serviceId: string, staffId: string) {
  const { businessId } = session;
  const service = await tx.service.findFirst({ where: { id: serviceId, businessId, active: true } });
  if (!service) throw new AgentApiError("service_not_found");
  const staff = await tx.staff.findFirst({ where: { id: staffId, businessId, active: true } });
  if (!staff?.serviceIds.includes(serviceId)) throw new AgentApiError("staff_not_found");
  return { service, staff };
}

export async function createSandboxProposal(tx: Prisma.TransactionClient, session: SandboxSession, body: unknown) {
  const input = proposalSchema.parse(body);
  requireSandboxBusiness(input.business);
  if (await tx.agentProposal.count({ where: { businessId: session.businessId, clientId: session.clientId } }) >= MAX_PROPOSALS)
    throw new AgentApiError("rate_limited", 3600);
  const { service, staff } = await currentTerms(tx, session, input.serviceId, input.staffId);
  if (service.version !== input.serviceVersion) throw new AgentApiError("stale_service");
  const now = await sandboxNow(tx);
  const start = new Date(input.start);
  if (start <= now) throw new AgentApiError("invalid_request");
  const snapshot = {
    businessId: session.businessId, clientId: session.clientId, serviceId: service.id, staffId: staff.id,
    ...placeForStaff(staff.id), duration: service.duration, priceOre: service.priceOre,
  };
  // The proposal itself is the private inbox item, scoped by its composite client foreign key.
  // No bearer approval token is issued.
  const row = await tx.agentProposal.create({ data: {
    ...snapshot, id: randomUUID(), serviceVersion: service.version, serviceName: service.name, staffName: staff.name,
    startsAt: start, proposalHash: bookingProposalHash({ ...snapshot, start }),
    expiresAt: new Date(Math.min(+now + CONSENT_MS, +start, +session.expiresAt)),
    consentDelivery: SANDBOX_CHANNEL,
  } });
  return { proposal: proposalView(row, now), approvalRequired: true };
}

export async function getSandboxProposal(tx: Prisma.TransactionClient, session: SandboxSession, id: string) {
  const row = await tx.agentProposal.findFirst({
    where: { id, clientId: session.clientId, businessId: session.businessId, consentDelivery: SANDBOX_CHANNEL },
  });
  if (!row) throw new AgentApiError("booking_not_found");
  return { proposal: proposalView(row, await sandboxNow(tx)) };
}

/** Only the isolated phone flow may call this with an authenticated, locked session. */
export async function decideSandboxProposal(
  tx: Prisma.TransactionClient, session: SandboxSession, id: string, shownHash: string, decision: "yes" | "no",
) {
  const [row] = await tx.$queryRaw<AgentProposal[]>`
    SELECT * FROM "AgentProposal" WHERE "id" = ${id} AND "clientId" = ${session.clientId}
      AND "businessId" = ${session.businessId} AND "consentDelivery" = ${SANDBOX_CHANNEL}
    FOR UPDATE
  `;
  const now = await sandboxNow(tx);
  if (!row || row.status !== "pending" || row.expiresAt <= now || session.expiresAt <= now ||
      row.proposalHash !== shownHash || row.proposalHash !== proposalHash(row))
    throw new AgentApiError("mandate_denied");
  if (decision === "no") {
    await tx.agentProposal.update({ where: { id }, data: { status: "declined" } });
    return { status: "declined" };
  }
  const { service, staff } = await currentTerms(tx, session, row.serviceId, row.staffId);
  if (service.version !== row.serviceVersion || service.duration !== row.duration || service.priceOre !== row.priceOre ||
      row.locationId !== placeForStaff(staff.id).locationId || row.scheduleId !== placeForStaff(staff.id).scheduleId)
    throw new AgentApiError("mandate_denied");
  const mandate = await tx.agentMandate.create({ data: {
    businessId: row.businessId, clientId: row.clientId, serviceId: row.serviceId, staffId: row.staffId,
    locationId: row.locationId, scheduleId: row.scheduleId, validFrom: row.startsAt,
    validUntil: new Date(+row.startsAt + row.duration * 60_000), expiresAt: row.expiresAt,
    maxPriceOre: row.priceOre, origin: "customer-consent", originReference: row.id,
    proposalHash: row.proposalHash, verifiedVia: SANDBOX_CHANNEL,
  } });
  await tx.agentProposal.update({ where: { id }, data: { status: "approved", mandateId: mandate.id } });
  return { status: "approved" };
}

export async function bookSandboxProposal(tx: Prisma.TransactionClient, agent: SandboxAgent, body: unknown, rawKey: string | null) {
  const key = scopedIdempotencyKey(agent, rawKey);
  const input = scopedBooking.parse(body);
  requireSandboxBusiness(input.business);
  if (!input.confirmed) throw new AgentApiError("confirmation_required");
  const { mandateId } = input;
  if (!mandateId) throw new AgentApiError("mandate_required");
  const { businessId, clientId } = agent;
  let replayed = false;
  const booking = await createSandboxBooking(tx, businessId, {
    serviceId: input.serviceId, serviceVersion: input.serviceVersion, staffId: input.staffId, start: input.start,
    customerName: SANDBOX_CUSTOMER.name, customerEmail: SANDBOX_CUSTOMER.email,
  }, key, `${AGENT_API_CHANNEL}${clientId}`, {
    authorize: async inner => {
      if (agent.expiresAt <= await sandboxNow(inner)) throw new AgentApiError("unauthorized");
    },
    beforeInsert: async (inner, service) => {
      const [mandate] = await inner.$queryRaw<AgentMandate[]>`
        SELECT * FROM "AgentMandate" WHERE "id" = ${mandateId} AND "businessId" = ${businessId}
          AND "clientId" = ${clientId} AND "verifiedVia" = ${SANDBOX_CHANNEL} FOR UPDATE
      `;
      assertMandatedBooking(mandate ?? null, {
        businessId, clientId, serviceId: input.serviceId, staffId: input.staffId, ...placeForStaff(input.staffId),
        start: new Date(input.start), priceOre: service.priceOre, duration: service.duration,
      }, await sandboxNow(inner));
      const proposal = await inner.agentProposal.findFirst({
        where: { id: mandate.originReference, businessId, clientId, consentDelivery: SANDBOX_CHANNEL, status: "approved", mandateId },
      });
      if (!proposal || proposal.serviceVersion !== input.serviceVersion || proposal.proposalHash !== mandate.proposalHash ||
          proposalHash(proposal) !== mandate.proposalHash ||
          await inner.agentBooking.findFirst({ where: { mandateId, businessId, clientId } }))
        throw new AgentApiError("mandate_denied");
      if (await inner.agentBooking.count({ where: { businessId, clientId } }) >= MAX_SANDBOX_BOOKINGS)
        throw new AgentApiError("rate_limited", 3600);
    },
    booked: async (inner, row, isReplay) => {
      if (isReplay) {
        if (!await inner.agentBooking.findFirst({ where: { bookingId: row.id, businessId, clientId, mandateId } }))
          throw new AgentApiError("idempotency_conflict");
        replayed = true;
      } else {
        await inner.agentBooking.create({ data: {
          bookingId: row.id, nativeBookingId: row.id, keyId: agent.keyId, businessId, clientId, mandateId,
        } });
      }
    },
  });
  const staff = await tx.staff.findFirst({ where: { id: booking.staffId, businessId }, select: { name: true } });
  const result = { apiVersion: API_VERSION, replayed, booking: projectAgentBooking(booking, staff?.name ?? null) };
  return replayed ? result : new Created(result);
}

export async function getSandboxBooking(tx: Prisma.TransactionClient, session: SandboxSession, id: string) {
  const { businessId, clientId } = session;
  const owned = await tx.agentBooking.findFirst({ where: { bookingId: id, businessId, clientId }, include: { booking: true } });
  if (!owned?.booking) throw new AgentApiError("booking_not_found");
  const staff = await tx.staff.findFirst({ where: { id: owned.booking.staffId, businessId }, select: { name: true } });
  return { apiVersion: API_VERSION, booking: projectAgentBooking(owned.booking, staff?.name ?? null) };
}
