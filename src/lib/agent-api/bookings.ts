import { recordAudit } from "./audit";
import { isPublicReadonly, assertWritable } from "../public-readonly";
import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "../db";
import { DEMO_BUSINESS_ID } from "../config";
import { AGENT_API_CHANNEL } from "../domain";
import { ZONE } from "../time";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./keys";
import { API_VERSION, business, Created, mapAgentError } from "./v1";
import { assertCurrentAgent, lockMandate } from "./mandates";
import { assertMandatedBooking } from "./mandate-policy";
import { proposalHash } from "./proposals";
import { placeForStaff } from "./place";
import { assertCustomerChannelBinding } from "./customer-channel-lab";

import { createPartnerAgentBooking } from "./partner-bookings";
import { nativeBookingProvider } from "./provider/native";
import { getBookingProvider } from "./provider";
import type { ProviderBooking } from "./provider/types";

const id = z.string().trim().min(1).max(128);
const iso = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toISO({ suppressMilliseconds: true })!;

export const agentBookingSchema = z
  .object({
    business: id,
    serviceId: id,
    serviceVersion: z.number().int().min(1),
    staffId: id,
    start: z.iso.datetime({ offset: true }),
    customer: z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.email().max(254),
      })
      .strict(),
    confirmed: z.boolean(),
    mandateId: id.optional(),
  })
  .strict();

async function staffName(staffId: string, businessId = "demo") {
  if (businessId !== "demo") return (await getBookingProvider(businessId).listServices()).resources.find(s => s.id === staffId)?.name ?? null;
  return (await db.staff.findFirst({ where: { id: staffId, businessId: DEMO_BUSINESS_ID }, select: { name: true } }))?.name ?? null;
}

// Agent-facing view. Never includes customer name/email.
async function bookingView(b: ProviderBooking, businessId = "demo") {
  return projectAgentBooking(b, await staffName(b.staffId, businessId));
}

export function projectAgentBooking(b: ProviderBooking, name: string | null) {
  return {
    id: b.id,
    status: b.status,
    start: iso(b.startsAt),
    end: iso(new Date(b.startsAt.getTime() + b.duration * 60000)),
    durationMinutes: b.duration,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    ...placeForStaff(b.staffId),
    staff: { id: b.staffId, name },
    version: b.version,
    createdAt: iso(b.createdAt),
  };
}

async function recordEvent(
  principal: AgentPrincipal,
  action: "book" | "cancel",
  outcome: string,
  detail: { serviceName?: string | null; staffName?: string | null; startsAt?: Date | null } = {},
) {
  try {
    await db.agentApiEvent.create({
      data: { keyId: principal.keyId, businessId: principal.businessId, action, outcome, ...detail },
    });
  } catch {
    console.error("AGENT_API_EVENT_FAILED");
  }
}

/** Stable client namespace survives rotation; another client cannot replay it. */
export function scopedIdempotencyKey(principal: Pick<AgentPrincipal, "clientId">, value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) throw new AgentApiError("idempotency_key_required");
  return createHash("sha256").update(`agent-api:${principal.clientId}:${raw}`).digest("hex");
}

export async function createBookingV1(principal: AgentPrincipal, _params: URLSearchParams, request: Request) {
  const key = request.headers.get("idempotency-key");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AgentApiError("invalid_request");
  }
  return createAgentBooking(principal, key, body);
}

/** Shared by HTTP and MCP. Returns Created for a new booking, a plain body for a replay. */
export async function createAgentBooking(principal: AgentPrincipal, rawKey: string | null | undefined, body: unknown) {
  assertWritable();
  if (!principal.scopes.includes("bookings:write")) throw new AgentApiError("forbidden_scope");
  const idempotencyKey = scopedIdempotencyKey(principal, rawKey);
  const parsed = agentBookingSchema.safeParse(body);
  if (!parsed.success) throw new AgentApiError("invalid_request");
  const input = parsed.data;
  business(principal, input.business);
  if (!input.confirmed) throw new AgentApiError("confirmation_required");
  if (!input.customer.email.toLowerCase().endsWith("@example.test"))
    throw new AgentApiError("synthetic_contact_required");
  if (!input.mandateId) throw new AgentApiError("mandate_required");
  if (getBookingProvider(principal.businessId) !== nativeBookingProvider) {
    try {
      const result = await createPartnerAgentBooking(principal, input, idempotencyKey);
      await recordEvent(principal, "book", result.replayed ? "replayed" : "booked", {
        serviceName: result.booking.serviceName, staffName: await staffName(input.staffId, principal.businessId), startsAt: result.booking.startsAt,
      });
      const body = { apiVersion: API_VERSION, replayed: result.replayed, booking: await bookingView(result.booking, principal.businessId) };
      return result.replayed ? body : new Created(body);
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (["slot_unavailable", "stale_service", "rate_limited", "idempotency_conflict"].includes(error.code))
          await recordEvent(principal, "book", error.code === "slot_unavailable" ? "conflict" : error.code);
        if (error.code === "mandate_denied") {
          const mandate = await db.agentMandate.findFirst({ where: { id: input.mandateId, clientId: principal.clientId, businessId: principal.businessId } });
          if (mandate && +mandate.expiresAt <= Date.now()) await recordAudit({
            businessId: "lab-partner", event: "mandate.expired", outcome: "expired", clientId: principal.clientId,
            mandateId: mandate.id, ...(mandate.origin === "customer-consent" ? { proposalId: mandate.originReference } : {}),
          });
        }
      }
      throw error;
    }
  }
  const staff = await staffName(input.staffId);
  const service = await db.service.findFirst({
    where: { id: input.serviceId, businessId: DEMO_BUSINESS_ID },
    select: { name: true },
  });
  let expired = false;
  let proposalId: string | undefined;
  try {
    let replayed = false;
    const booking = await nativeBookingProvider.createBooking(
      {
        serviceId: input.serviceId,
        serviceVersion: input.serviceVersion,
        staffId: input.staffId,
        start: input.start,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
      },
      idempotencyKey,
      `${AGENT_API_CHANNEL}${principal.clientId}`,
      {
        authorize: tx => assertCurrentAgent(tx, principal),
        beforeInsert: async (tx, currentService) => {
          const mandate = await lockMandate(tx, input.mandateId!);
          if (mandate?.clientId === principal.clientId && mandate.businessId === principal.businessId) {
            expired = +mandate.expiresAt <= Date.now();
            if (mandate.origin === "customer-consent") proposalId = mandate.originReference;
          }
          assertMandatedBooking(mandate, {
            businessId: principal.businessId, clientId: principal.clientId,
            serviceId: input.serviceId, staffId: input.staffId,
            ...placeForStaff(input.staffId),
            start: new Date(input.start), duration: currentService.duration, priceOre: currentService.priceOre,
          });
          if (mandate?.origin === "customer-consent") {
            const proposals = await tx.$queryRaw<import("@prisma/client").AgentProposal[]>`SELECT * FROM "AgentProposal" WHERE "id"=${mandate.originReference} FOR SHARE`;
            const proposal = proposals[0];
            if (!proposal || proposal.status !== "approved" || proposal.mandateId !== mandate.id ||
                proposal.proposalHash !== mandate.proposalHash || proposalHash(proposal) !== mandate.proposalHash)
              throw new AgentApiError("mandate_denied");
            assertCustomerChannelBinding(proposal, mandate, input.customer);
          }
          if (await tx.agentBooking.findUnique({ where: { mandateId: input.mandateId! } }))
            throw new AgentApiError("mandate_denied");
        },
        booked: async (tx, row, isReplay) => {
          if (isReplay) {
            const link = await tx.agentBooking.findUnique({ where: { bookingId: row.id } });
            if (!link || link.clientId !== principal.clientId || link.businessId !== principal.businessId || link.mandateId !== input.mandateId)
              throw new AgentApiError("idempotency_conflict");
            replayed = true;
          } else {
            await tx.agentBooking.create({ data: {
              bookingId: row.id, nativeBookingId: row.id, keyId: principal.keyId, clientId: principal.clientId,
              businessId: principal.businessId, mandateId: input.mandateId,
            } });
          }
        },
      },
    );
    await recordEvent(principal, "book", replayed ? "replayed" : "booked", {
      serviceName: booking.serviceName, staffName: staff, startsAt: booking.startsAt,
    });
    if (!replayed) {
      const detail = { clientId: principal.clientId, mandateId: input.mandateId, proposalId, bookingId: booking.id };
      await recordAudit({ ...detail, event: "mandate.consumed", outcome: "booked" });
      await recordAudit({ ...detail, event: "booking.created", outcome: "booked" });
    }
    const body = { apiVersion: API_VERSION, replayed, booking: await bookingView(booking) };
    return replayed ? body : new Created(body);
  } catch (error) {
    if (expired) await recordAudit({ event: "mandate.expired", outcome: "expired", clientId: principal.clientId, mandateId: input.mandateId, proposalId });
    const { code } = mapAgentError(error);
    if (code === "slot_unavailable" || code === "stale_service" || code === "rate_limited" || code === "idempotency_conflict")
      await recordEvent(principal, "book", code === "slot_unavailable" ? "conflict" : code, {
        serviceName: service?.name ?? null, staffName: staff,
        startsAt: DateTime.fromISO(input.start).isValid ? DateTime.fromISO(input.start).toJSDate() : null,
      });
    throw error;
  }
}

async function ownedBooking(principal: AgentPrincipal, bookingId: string) {
  const parsed = id.safeParse(bookingId);
  if (!parsed.success) throw new AgentApiError("booking_not_found");
  // Stable ownership survives credential rotation.
  const link = await db.agentBooking.findUnique({ where: { bookingId: parsed.data } });
  if (!link || link.clientId !== principal.clientId || link.businessId !== principal.businessId)
    throw new AgentApiError("booking_not_found");
  return getBookingProvider(principal.businessId).getBooking(parsed.data);
}

export async function getBookingV1(principal: AgentPrincipal, bookingId: string) {
  if (isPublicReadonly()) throw new AgentApiError("booking_not_found");
  if (!principal.scopes.includes("bookings:read")) throw new AgentApiError("forbidden_scope");
  return { apiVersion: API_VERSION, booking: await bookingView(await ownedBooking(principal, bookingId), principal.businessId) };
}

export async function cancelBookingV1(principal: AgentPrincipal, bookingId: string) {
  assertWritable();
  if (!principal.scopes.includes("bookings:write")) throw new AgentApiError("forbidden_scope");
  const owned = await ownedBooking(principal, bookingId);
  const auditLink = await db.agentBooking.findUnique({ where: { bookingId: owned.id } });
  const provider = getBookingProvider(principal.businessId);
  const result = provider === nativeBookingProvider
    ? await nativeBookingProvider.cancelBooking(owned.id, principal.clientId, tx => assertCurrentAgent(tx, principal))
    : await db.$transaction(async tx => { await assertCurrentAgent(tx, principal); return provider.cancelBooking(owned.id, principal.clientId); });
  if (!result.already)
    await recordEvent(principal, "cancel", "cancelled", {
      serviceName: result.row.serviceName, staffName: await staffName(result.row.staffId, principal.businessId), startsAt: result.row.startsAt,
    });
  if (!result.already) {
    await recordAudit({ businessId: principal.businessId as "demo" | "lab-partner", event: "booking.cancelled", outcome: "cancelled", clientId: principal.clientId, bookingId: owned.id, mandateId: auditLink?.mandateId ?? undefined });
  }
  return { apiVersion: API_VERSION, alreadyCancelled: result.already, booking: await bookingView(result.row, principal.businessId) };
}
