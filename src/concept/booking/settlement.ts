import { returnRedemptions } from "../giftcards/cards";
import { demoPayments } from "../connections/demo";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { deadline, visitTime, FREE_CHANGE_HOURS } from "./policy";
import { feeMinor, settleFee, termsOf, type BookingProtection, type DemoMethod, type Incident } from "./protection";

export interface FeeDecision {
  type: "booking/fee";
  id: string;
  incident: Incident;
  outcome: "charge" | "waive";
  reason?: string;
}

export function collect(reference: string, amountMinor: number, currency: string, kind: "deposit" | "fee", method: DemoMethod, payments = demoPayments) {
  const result = payments.checkoutNow({
    reference, amount: { amountMinor, currency }, description: t(`protection.${kind}`),
    methods: [method], successUrl: "", cancelUrl: "", idempotencyKey: `${reference}-${kind}`,
  });
  return result.ok ? result.value.id : undefined;
}

function refund(protection: BookingProtection, amountMinor: number, payments: typeof demoPayments): BookingProtection | undefined {
  if (!amountMinor) return protection;
  if (!protection.deposit || protection.refund) return;
  const paymentId = protection.deposit.id;
  const result = payments.refundNow({
    paymentId, amount: { amountMinor, currency: protection.terms.currency }, idempotencyKey: `${paymentId}-refund`,
  });
  if (result.ok) return { ...protection, refund: { id: result.value.id, amountMinor } };
}

export function refundCancellation(booking: Booking, payments = demoPayments): Booking | undefined {
  const protection = booking.protection;
  if (!protection?.deposit || protection.refund) return booking;
  const refunded = refund(protection, protection.terms.depositMinor, payments);
  if (refunded) return { ...booking, protection: refunded };
}

export function eligibleIncident(booking: Booking, at: number): Incident | undefined {
  if (booking.status !== "booked") return;
  if (at >= visitTime(booking).toMillis()) return "noshow";
  if (at > deadline(booking, booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS).toMillis()) return "late";
}

export function salonCancellationOnly(booking: Booking, at: number) {
  return !!(booking.protection?.deposit || booking.protection?.terms.latePercent) && !!eligibleIncident(booking, at);
}

export function decideFee(state: DemoState, action: FeeDecision, at: number, payments = demoPayments): DemoState {
  const booking = state.bookings.find(b => b.id === action.id);
  if (!booking || eligibleIncident(booking, at) !== action.incident) return state;
  const reason = action.reason?.trim();
  if (action.outcome !== "charge" && (action.outcome !== "waive" || !reason || reason.length > 200)) return state;
  const terms = termsOf(booking, state);
  const protection = booking.protection ?? { terms };
  const proposedMinor = feeMinor(terms, action.incident);
  const settlement = settleFee(protection.deposit ? terms.depositMinor : 0, action.outcome === "charge" ? proposedMinor : 0);
  const reference = protection.deposit?.id ?? `${state.salon.slug}-${booking.id}-${booking.date}-${terms.version}`;
  const paymentId = settlement.additional ? collect(reference, settlement.additional, terms.currency, "fee", protection.deposit?.method ?? "card", payments) : undefined;
  if (settlement.additional && !paymentId) return state;
  const settled = refund(protection, settlement.refund, payments);
  if (!settled) return state;
  const decision: BookingProtection["decision"] = {
    incident: action.incident, outcome: action.outcome, proposedMinor, chargedMinor: settlement.additional,
    actor: "owner", at, paymentId, reason: action.outcome === "waive" ? reason : undefined,
  };
  const updated: Booking = { ...booking, status: action.incident === "noshow" ? "noshow" : "cancelled", protection: { ...settled, decision } };
  return { ...state, giftCards: returnRedemptions(state.giftCards, new Set([booking.id])), bookings: state.bookings.map(b => b.id === booking.id ? updated : b) };
}
