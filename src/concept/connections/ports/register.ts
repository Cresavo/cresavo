import type { PortResult, UtcTimestamp } from "../core";

// The in-salon cash register: a sale at the counter, paid by card, Swish or
// cash, with a receipt. The booking layer reaches it only through `settle`
// (src/concept/booking/settle.ts), so a certified register with a control unit
// can replace the demo adapter without touching the booking flow. Money is
// integer minor units throughout (öre for SEK).

export type RegisterMethod = "card" | "swish" | "cash";
/** `demo`: the browser demo register, never reported to bookkeeping. `certified`: a register with a control unit. */
export type RegisterKind = "demo" | "certified";

export interface SaleLine {
  description: string;
  /** Price including VAT. */
  grossMinor: number;
  vatRatePercent: number;
}

export interface VatLine {
  ratePercent: number;
  grossMinor: number;
  netMinor: number;
  vatMinor: number;
}

export interface StartSaleInput {
  business: string;
  /** Our booking id. One sale per reference. */
  reference: string;
  currency: string;
  /** Business-local day of the sale, YYYY-MM-DD. */
  date: string;
  lines: SaleLine[];
  /** Already paid before the counter: a deposit online, a gift card. Deducted from the amount due. */
  prepaidMinor: number;
  idempotencyKey: string;
}

export interface Sale {
  id: string;
  business: string;
  reference: string;
  currency: string;
  date: string;
  lines: SaleLine[];
  totalMinor: number;
  prepaidMinor: number;
  dueMinor: number;
  state: "open" | "awaiting" | "paid" | "refunded";
}

export interface RecordPaymentInput {
  saleId: string;
  method: RegisterMethod;
  amountMinor: number;
  /** Cash only: what the customer handed over. */
  tenderedMinor?: number;
  /**
   * True when the payment is started but not confirmed yet, for example a
   * Swish QR code on the customer's phone. Confirm it with `completePayment`;
   * the receipt is issued then.
   */
  pending?: boolean;
  at: UtcTimestamp;
  idempotencyKey: string;
}

export interface RegisterPayment {
  id: string;
  saleId: string;
  method: RegisterMethod;
  amountMinor: number;
  tenderedMinor?: number;
  changeMinor?: number;
  state: "pending" | "completed" | "failed";
}

/** One receipt: a completed sale or a refund of one. */
export interface RegisterRecord {
  id: string;
  /** Set by the adapter, never by the caller. Bookkeeping skips `demo`. */
  register: RegisterKind;
  kind: "sale" | "refund";
  receiptNumber: string;
  business: string;
  saleId: string;
  reference: string;
  date: string;
  at: UtcTimestamp;
  currency: string;
  lines: SaleLine[];
  vat: VatLine[];
  totalMinor: number;
  /** Paid before the counter. Always 0 on a refund: a deposit or gift card is returned by its own flow. */
  prepaidMinor: number;
  /** Taken at the counter; negative on a refund. */
  paidMinor: number;
  method: RegisterMethod;
  tenderedMinor?: number;
  changeMinor?: number;
  /** A refund: the receipt it reverses. */
  refundOf?: string;
}

export interface DailyReport {
  business: string;
  date: string;
  currency: string;
  register: RegisterKind;
  receipts: number;
  refunds: number;
  /** Counter takings per method, plus what was prepaid. Sums to `totalMinor`. */
  methods: { method: RegisterMethod | "prepaid"; amountMinor: number }[];
  vat: VatLine[];
  totalMinor: number;
}

export interface RegisterInfo {
  provider: string;
  kind: RegisterKind | "unavailable";
}

export interface RegisterPort {
  readonly info: RegisterInfo;
  startSale(input: StartSaleInput): Promise<PortResult<Sale>>;
  recordPayment(input: RecordPaymentInput): Promise<PortResult<{ sale: Sale; payment: RegisterPayment; receipt?: RegisterRecord }>>;
  /**
   * Confirms or fails a pending payment. A confirmed one issues the receipt.
   * `method` is for a payment the customer finished on their own phone, where
   * they chose card or Swish after the register started it.
   */
  completePayment(input: { paymentId: string; outcome: "paid" | "failed"; method?: Exclude<RegisterMethod, "cash">; at: UtcTimestamp }): Promise<PortResult<{ sale: Sale; payment: RegisterPayment; receipt?: RegisterRecord }>>;
  /**
   * Refunds what the sale took at the counter with a refund receipt. A deposit
   * or gift card used for the sale stays with the booking's own refund flows.
   */
  refund(input: { receiptId: string; date: string; at: UtcTimestamp; idempotencyKey: string }): Promise<PortResult<RegisterRecord>>;
  dailyReport(input: { business: string; date: string }): Promise<PortResult<DailyReport>>;
  /** Every receipt for the business, oldest first. */
  receipts(business: string): RegisterRecord[];
}

/** VAT inside a price that includes it, rounded half away from zero to a minor unit. */
export function vatInMinor(grossMinor: number, ratePercent: number): number {
  const vat = Math.round((Math.abs(grossMinor) * ratePercent) / (100 + ratePercent));
  return grossMinor < 0 ? -vat : vat;
}

/** One VAT line per rate, highest rate first. */
export function vatLines(lines: readonly Pick<SaleLine, "grossMinor" | "vatRatePercent">[]): VatLine[] {
  const gross = new Map<number, number>();
  for (const line of lines) gross.set(line.vatRatePercent, (gross.get(line.vatRatePercent) ?? 0) + line.grossMinor);
  return [...gross.entries()].sort(([a], [b]) => b - a).map(([ratePercent, grossMinor]) => {
    const vatMinor = vatInMinor(grossMinor, ratePercent);
    return { ratePercent, grossMinor, netMinor: grossMinor - vatMinor, vatMinor };
  });
}

/**
 * The sale's lines scaled to the part of it taken at the counter, negated for
 * a refund receipt. Shares are rounded down per line; the last line takes the
 * remainder, so the lines sum to exactly `-paidMinor`.
 */
export function refundLines(lines: readonly SaleLine[], totalMinor: number, paidMinor: number): SaleLine[] {
  let left = paidMinor;
  return lines.map((line, i) => {
    const share = i === lines.length - 1 ? left : totalMinor ? Math.floor((line.grossMinor * paidMinor) / totalMinor) : 0;
    left -= share;
    return { ...line, grossMinor: -share };
  });
}

/** Change for a cash payment, or null when the customer handed over too little. */
export function cashChange(dueMinor: number, tenderedMinor: number): number | null {
  if (!Number.isSafeInteger(dueMinor) || !Number.isSafeInteger(tenderedMinor) || dueMinor < 0 || tenderedMinor < dueMinor) return null;
  return tenderedMinor - dueMinor;
}

/** `DEMO-20261125-0001`: the demo prefix, the day and the receipt's place in that day for the business. */
export function demoReceiptNumber(date: string, sequence: number): string {
  return `DEMO-${date.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;
}

/** Sums the receipts' own VAT lines per rate, highest rate first, so the day matches its receipts to the öre. */
function sumVat(records: readonly RegisterRecord[]): VatLine[] {
  const rates = new Map<number, VatLine>();
  for (const line of records.flatMap((r) => r.vat)) {
    const sum = rates.get(line.ratePercent) ?? { ratePercent: line.ratePercent, grossMinor: 0, netMinor: 0, vatMinor: 0 };
    rates.set(line.ratePercent, { ...sum, grossMinor: sum.grossMinor + line.grossMinor, netMinor: sum.netMinor + line.netMinor, vatMinor: sum.vatMinor + line.vatMinor });
  }
  return [...rates.values()].sort((a, b) => b.ratePercent - a.ratePercent);
}

/** The day's totals from its receipts: refunds count negative. */
export function summariseDay(records: readonly RegisterRecord[], business: string, date: string, currency: string, register: RegisterKind): DailyReport {
  const day = records.filter((r) => r.business === business && r.date === date);
  const methods = new Map<RegisterMethod | "prepaid", number>();
  const add = (method: RegisterMethod | "prepaid", amount: number) => amount && methods.set(method, (methods.get(method) ?? 0) + amount);
  for (const record of day) {
    add(record.method, record.paidMinor);
    // A refund reverses only the counter payment; prepaid money is returned elsewhere.
    if (record.kind === "sale") add("prepaid", record.prepaidMinor);
  }
  const vat = sumVat(day);
  return {
    business, date, currency, register,
    receipts: day.filter((r) => r.kind === "sale").length,
    refunds: day.filter((r) => r.kind === "refund").length,
    methods: [...methods.entries()].map(([method, amountMinor]) => ({ method, amountMinor })),
    vat,
    totalMinor: vat.reduce((sum, line) => sum + line.grossMinor, 0),
  };
}
