import type { ConnectionError, UtcTimestamp } from "../connections/core";
import type { CheckoutSession, PaymentMethod, PaymentsPort } from "../connections/ports/payments";
import type { RegisterMethod, RegisterPayment, RegisterPort, RegisterRecord, Sale, SaleLine } from "../connections/ports/register";
import type { Booking, DemoState } from "../data/types";
import { VAT_PERCENT } from "../finance/accounting";
import { paidWithCards } from "../giftcards/cards";
import { findService } from "../selectors";
import { toMinor } from "./protection";

// How a visit gets paid. An online intent goes to the payments port (Stripe
// when live, simulated in the demo); an in-salon intent goes to the register
// port (the demo register now, a certified one later). Callers name the
// intent, never the provider, so swapping either adapter leaves them alone.

/** What is owed for a visit, in minor units. */
export interface BillableVisit {
  business: string;
  reference: string;
  currency: string;
  /** The business-local day the payment is taken. */
  date: string;
  lines: SaleLine[];
  /** Deposit (not refunded) plus gift cards. */
  prepaidMinor: number;
}

export type SettleIntent =
  | { channel: "online"; method: PaymentMethod; successUrl: string; cancelUrl: string; idempotencyKey: string }
  | { channel: "in-salon"; method: RegisterMethod; tenderedMinor?: number; pending?: boolean; at: UtcTimestamp };

export interface SettlePorts {
  payments: Pick<PaymentsPort, "createCheckout">;
  register: RegisterPort;
}

export type Settlement =
  | { ok: true; channel: "online"; checkout: CheckoutSession }
  | { ok: true; channel: "in-salon"; sale: Sale; payment: RegisterPayment; receipt?: RegisterRecord }
  | { ok: false; error: ConnectionError };

export function billableVisit(state: DemoState, booking: Booking, date: string): BillableVisit {
  const currency = booking.protection?.terms.currency ?? state.localization.currency;
  const priceMinor = toMinor(booking.price, currency);
  const protection = booking.protection;
  const deposit = protection?.deposit && !protection.refund ? protection.terms.depositMinor : 0;
  const prepaidMinor = Math.min(priceMinor, deposit + toMinor(paidWithCards(state, booking.id), currency));
  return {
    business: state.salon.slug, reference: booking.id, currency, date, prepaidMinor,
    lines: [{ description: findService(state, booking.serviceId)?.name ?? booking.serviceId, grossMinor: priceMinor, vatRatePercent: VAT_PERCENT }],
  };
}

export const totalOf = (visit: Pick<BillableVisit, "lines">) => visit.lines.reduce((sum, line) => sum + line.grossMinor, 0);
export const dueOf = (visit: BillableVisit) => totalOf(visit) - visit.prepaidMinor;

export async function settle(visit: BillableVisit, intent: SettleIntent, ports: SettlePorts): Promise<Settlement> {
  if (intent.channel === "online") {
    const result = await ports.payments.createCheckout({
      amount: { amountMinor: dueOf(visit), currency: visit.currency },
      description: visit.lines.map((line) => line.description).join(", "),
      reference: visit.reference, methods: [intent.method],
      successUrl: intent.successUrl, cancelUrl: intent.cancelUrl, idempotencyKey: intent.idempotencyKey,
    });
    return result.ok ? { ok: true, channel: "online", checkout: result.value } : { ok: false, error: result.error };
  }
  const key = `${visit.business}-${visit.reference}`;
  const started = await ports.register.startSale({ ...visit, idempotencyKey: `${key}-sale` });
  if (!started.ok) return { ok: false, error: started.error };
  const sale = started.value;
  const paid = await ports.register.recordPayment({
    saleId: sale.id, method: intent.method, amountMinor: sale.dueMinor, at: intent.at,
    idempotencyKey: `${sale.id}-${intent.method}-${intent.tenderedMinor ?? ""}-${intent.pending ? "pending" : "now"}`,
    ...(intent.tenderedMinor === undefined ? {} : { tenderedMinor: intent.tenderedMinor }),
    ...(intent.pending ? { pending: true } : {}),
  });
  return paid.ok ? { ok: true, channel: "in-salon", ...paid.value } : { ok: false, error: paid.error };
}
