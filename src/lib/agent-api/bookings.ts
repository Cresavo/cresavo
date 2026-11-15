import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "../db";
import { DEMO_BUSINESS_ID } from "../config";
import { AGENT_API_CHANNEL, createBooking } from "../domain";
import { DomainError } from "../errors";
import { ZONE } from "../time";
import { lockConfiguration } from "../workspace-write";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./keys";
import { API_VERSION, business, Created, mapAgentError } from "./v1";
import { assertCurrentAgent, lockMandate } from "./mandates";
import { assertMandatedBooking } from "./mandate-policy";
import { placeForStaff } from "./place";

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

type BookingRow = {
  id: string; status: string; startsAt: Date; endsAt: Date; duration: number;
  serviceId: string; serviceName: string; staffId: string; version: number; createdAt: Date;
};

async function staffName(staffId: string) {
  return (await db.staff.findFirst({ where: { id: staffId, businessId: DEMO_BUSINESS_ID }, select: { name: true } }))?.name ?? null;
}

// Agent-facing view. Never includes customer name/email.
async function bookingView(b: BookingRow) {
  return {
    id: b.id,
    status: b.status,
    start: iso(b.startsAt),
    end: iso(new Date(b.startsAt.getTime() + b.duration * 60000)),
    durationMinutes: b.duration,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    ...placeForStaff(b.staffId),
    staff: { id: b.staffId, name: await staffName(b.staffId) },
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
export function scopedIdempotencyKey(principal: AgentPrincipal, value: string | null | undefined) {
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
  const idempotencyKey = scopedIdempotencyKey(principal, rawKey);
  const parsed = agentBookingSchema.safeParse(body);
  if (!parsed.success) throw new AgentApiError("invalid_request");
  const input = parsed.data;
  business(principal, input.business);
  if (!input.confirmed) throw new AgentApiError("confirmation_required");
  if (!input.customer.email.toLowerCase().endsWith("@example.test"))
    throw new AgentApiError("synthetic_contact_required");
  if (!input.mandateId) throw new AgentApiError("mandate_required");
  const staff = await staffName(input.staffId);
  const service = await db.service.findFirst({
    where: { id: input.serviceId, businessId: DEMO_BUSINESS_ID },
    select: { name: true },
  });
  try {
    let replayed = false;
    const booking = await createBooking(
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
      undefined,
      {
        authorize: tx => assertCurrentAgent(tx, principal),
        beforeInsert: async (tx, currentService) => {
          const mandate = await lockMandate(tx, input.mandateId!);
          assertMandatedBooking(mandate, {
            businessId: principal.businessId, clientId: principal.clientId,
            serviceId: input.serviceId, staffId: input.staffId,
            ...placeForStaff(input.staffId),
            start: new Date(input.start), duration: currentService.duration, priceOre: currentService.priceOre,
          });
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
              bookingId: row.id, keyId: principal.keyId, clientId: principal.clientId,
              businessId: principal.businessId, mandateId: input.mandateId,
            } });
          }
        },
      },
    );
    await recordEvent(principal, "book", replayed ? "replayed" : "booked", {
      serviceName: booking.serviceName, staffName: staff, startsAt: booking.startsAt,
    });
    const body = { apiVersion: API_VERSION, replayed, booking: await bookingView(booking) };
    return replayed ? body : new Created(body);
  } catch (error) {
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
  const row = await db.booking.findFirst({ where: { id: parsed.data, businessId: DEMO_BUSINESS_ID } });
  if (!row) throw new AgentApiError("booking_not_found");
  return row;
}

export async function getBookingV1(principal: AgentPrincipal, bookingId: string) {
  return { apiVersion: API_VERSION, booking: await bookingView(await ownedBooking(principal, bookingId)) };
}

export async function cancelBookingV1(principal: AgentPrincipal, bookingId: string) {
  const owned = await ownedBooking(principal, bookingId);
  const result = await db.$transaction(async (tx) => {
    await lockConfiguration(tx);
    await assertCurrentAgent(tx, principal);
    const [current] = await tx.$queryRaw<BookingRow[]>`
      SELECT * FROM "Booking" WHERE "id" = ${owned.id} AND "businessId" = ${DEMO_BUSINESS_ID} FOR UPDATE`;
    if (!current) throw new DomainError("Bokningen finns inte");
    if (current.status === "cancelled") return { row: current, already: true };
    const row = await tx.booking.update({
      where: { id: current.id },
      data: { status: "cancelled", version: { increment: 1 } },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: current.id, action: "cancel", actorKind: "agent-api", actorId: principal.clientId,
        previousStart: current.startsAt, previousEnd: current.endsAt, previousStaffId: current.staffId,
      },
    });
    return { row, already: false };
  }, { maxWait: 30000, timeout: 30000 });
  if (!result.already)
    await recordEvent(principal, "cancel", "cancelled", {
      serviceName: result.row.serviceName, staffName: await staffName(result.row.staffId), startsAt: result.row.startsAt,
    });
  return { apiVersion: API_VERSION, alreadyCancelled: result.already, booking: await bookingView(result.row) };
}
