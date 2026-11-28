import { db } from "../db";
import { requireConsentLab } from "./customer-identity";

// Demo lab only (docs/demo-agentic-booking.md): a customer-consented agent booking reports the
// confirmation and reminder the salon would send. Derived from the booking, never sent or stored.
const BOOKING_TOOLS = new Set(["create_booking", "usp_bookings_create", "get_booking", "usp_bookings_get"]);

/** Simulated lab notices are derived from the booking, never sent or persisted. */
export function simulatedNotices(start: string, createdAt: string, mask: string) {
  const begins = Date.parse(start), created = Date.parse(createdAt), hour = 3600000;
  const lead = begins - created >= 24 * hour ? 24 : begins - created >= 2 * hour ? 2 : null;
  return {
    confirmation: { channel: "email", status: "simulated", to: mask },
    reminder: lead === null
      ? { channel: "email", status: "not-scheduled", reason: "starts-within-two-hours" }
      : { channel: "email", status: "scheduled-simulated", at: new Date(begins - lead * hour).toISOString() },
  };
}

type BookingBody = { booking?: { id?: unknown; status?: unknown; start?: unknown; createdAt?: unknown } };

/** Adds `notices` to an MCP booking result inside the consent lab; otherwise returns the body unchanged. */
export async function withLabNotices(tool: string, body: unknown): Promise<unknown> {
  if (!BOOKING_TOOLS.has(tool)) return body;
  try {
    requireConsentLab();
    const booking = (body as BookingBody)?.booking;
    if (!booking || booking.status !== "confirmed" || typeof booking.id !== "string" ||
        typeof booking.start !== "string" || typeof booking.createdAt !== "string") return body;
    const link = await db.agentBooking.findUnique({ where: { bookingId: booking.id }, select: { mandateId: true } });
    if (!link?.mandateId) return body;
    const proposal = await db.agentProposal.findUnique({ where: { mandateId: link.mandateId }, select: { contactEmailMask: true } });
    if (!proposal?.contactEmailMask) return body;
    return { ...(body as object), notices: simulatedNotices(booking.start, booking.createdAt, proposal.contactEmailMask) };
  } catch {
    // Outside the lab, or a lookup failed: the booking result stays exactly as it was.
    return body;
  }
}
