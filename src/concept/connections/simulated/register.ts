import { connectionError, fail, isCurrency, ok, stableHash, type ConnectionErrorCode, type PortResult } from "../core";
import {
  cashChange, demoReceiptNumber, summariseDay, vatLines,
  type RecordPaymentInput, type RegisterPayment, type RegisterPort, type RegisterRecord, type Sale, type StartSaleInput,
} from "../ports/register";

// The demo register: deterministic, no network, no clock of its own. Its
// receipts are numbered DEMO-<day>-<n> and tagged `register: "demo"`, which
// the bookkeeping export skips. Only `createRegister` hands it out.

const PROVIDER = "demo-register";

/** Everything the demo register holds for one salon; the caller persists it. */
export interface RegisterBook {
  sales: Sale[];
  payments: RegisterPayment[];
  records: RegisterRecord[];
  /** Idempotency key -> fingerprint of the request and the id it produced. */
  keys: Record<string, { print: string; id: string }>;
}

export const emptyRegisterBook = (): RegisterBook => ({ sales: [], payments: [], records: [], keys: {} });

const refuse = (code: ConnectionErrorCode) => fail<never>(connectionError("payments", PROVIDER, code));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const amount = (n: number | undefined) => n === undefined || (Number.isSafeInteger(n) && n >= 0);

export function demoRegister(book: RegisterBook = emptyRegisterBook(), save: (book: RegisterBook) => void = () => undefined): RegisterPort {
  const commit = (next: RegisterBook) => {
    book = next;
    save(book);
  };
  /** The id an earlier request with this key produced, a conflict when the key came with other content, or undefined for a new key. */
  const replay = (key: string, request: unknown): PortResult<never> | string | undefined => {
    const known = book.keys[key];
    if (!known) return;
    return known.print === stableHash(JSON.stringify(request)) ? known.id : refuse("conflict");
  };
  const remember = (key: string, request: unknown, id: string) => ({ ...book.keys, [key]: { print: stableHash(JSON.stringify(request)), id } });

  const issue = (sale: Sale, payment: RegisterPayment, at: string): RegisterRecord => {
    const sequence = book.records.filter((r) => r.business === sale.business && r.date === sale.date).length + 1;
    return {
      id: `rcpt-${stableHash(`${sale.id}:${payment.id}`)}`, register: "demo", kind: "sale",
      receiptNumber: demoReceiptNumber(sale.date, sequence), business: sale.business, saleId: sale.id, reference: sale.reference,
      date: sale.date, at, currency: sale.currency, lines: sale.lines, vat: vatLines(sale.lines),
      totalMinor: sale.totalMinor, prepaidMinor: sale.prepaidMinor, paidMinor: payment.amountMinor, method: payment.method,
      ...(payment.tenderedMinor === undefined ? {} : { tenderedMinor: payment.tenderedMinor, changeMinor: payment.changeMinor }),
    };
  };
  const outcome = (payment: RegisterPayment) => {
    const sale = book.sales.find((s) => s.id === payment.saleId)!;
    const receipt = book.records.find((r) => r.kind === "sale" && r.saleId === sale.id);
    return ok({ sale, payment, ...(receipt ? { receipt } : {}) }, "simulated", null, payment.id);
  };

  return {
    info: { provider: PROVIDER, kind: "demo" },
    receipts: (business) => book.records.filter((r) => r.business === business),

    async startSale(input: StartSaleInput) {
      const totalMinor = input.lines.reduce((sum, line) => sum + line.grossMinor, 0);
      const valid = input.business && input.reference && input.idempotencyKey && isCurrency(input.currency) && DAY.test(input.date) &&
        input.lines.length > 0 && input.lines.every((l) => l.description.trim() && amount(l.grossMinor) && amount(l.vatRatePercent) && l.vatRatePercent <= 100) &&
        amount(input.prepaidMinor) && input.prepaidMinor <= totalMinor;
      if (!valid) return refuse("invalid_input");
      const earlier = replay(input.idempotencyKey, input);
      if (typeof earlier === "object") return earlier;
      const existing = book.sales.find((s) => s.id === earlier) ?? book.sales.find((s) => s.business === input.business && s.reference === input.reference && s.state !== "refunded");
      if (existing) return ok(existing, "simulated", null, existing.id);
      const id = `sale-${stableHash(`${input.business}:${input.reference}:${input.idempotencyKey}`)}`;
      const sale: Sale = {
        id, business: input.business, reference: input.reference, currency: input.currency, date: input.date, lines: input.lines,
        totalMinor, prepaidMinor: input.prepaidMinor, dueMinor: totalMinor - input.prepaidMinor, state: "open",
      };
      commit({ ...book, sales: [...book.sales, sale], keys: remember(input.idempotencyKey, input, id) });
      return ok(sale, "simulated", null, id);
    },

    async recordPayment(input: RecordPaymentInput) {
      const earlier = replay(input.idempotencyKey, input);
      if (typeof earlier === "object") return earlier;
      const known = book.payments.find((p) => p.id === earlier);
      if (known) return outcome(known);
      const sale = book.sales.find((s) => s.id === input.saleId);
      if (!sale) return refuse("not_found");
      if (sale.state !== "open") return refuse("conflict");
      const cash = input.method === "cash";
      if (input.amountMinor !== sale.dueMinor || !input.at || (cash ? input.tenderedMinor === undefined || input.pending : input.tenderedMinor !== undefined)) return refuse("invalid_input");
      const changeMinor = cash ? cashChange(sale.dueMinor, input.tenderedMinor!) : undefined;
      if (changeMinor === null) return refuse("invalid_input");
      const payment: RegisterPayment = {
        id: `pay-${stableHash(`${sale.id}:${input.idempotencyKey}`)}`, saleId: sale.id, method: input.method, amountMinor: input.amountMinor,
        state: input.pending ? "pending" : "completed",
        ...(cash ? { tenderedMinor: input.tenderedMinor, changeMinor } : {}),
      };
      const updated: Sale = { ...sale, state: input.pending ? "awaiting" : "paid" };
      commit({
        ...book,
        sales: book.sales.map((s) => (s.id === sale.id ? updated : s)),
        payments: [...book.payments, payment],
        records: input.pending ? book.records : [...book.records, issue(updated, payment, input.at)],
        keys: remember(input.idempotencyKey, input, payment.id),
      });
      return outcome(payment);
    },

    async completePayment(input) {
      const payment = book.payments.find((p) => p.id === input.paymentId);
      if (!payment) return refuse("not_found");
      if (payment.state !== "pending") return payment.state === (input.outcome === "paid" ? "completed" : "failed") ? outcome(payment) : refuse("conflict");
      const done: RegisterPayment = { ...payment, state: input.outcome === "paid" ? "completed" : "failed" };
      const sale = book.sales.find((s) => s.id === payment.saleId)!;
      const updated: Sale = { ...sale, state: input.outcome === "paid" ? "paid" : "open" };
      commit({
        ...book,
        sales: book.sales.map((s) => (s.id === sale.id ? updated : s)),
        payments: book.payments.map((p) => (p.id === payment.id ? done : p)),
        records: input.outcome === "paid" ? [...book.records, issue(updated, done, input.at)] : book.records,
      });
      return outcome(done);
    },

    async refund(input) {
      const earlier = replay(input.idempotencyKey, input);
      if (typeof earlier === "object") return earlier;
      const known = book.records.find((r) => r.id === earlier);
      if (known) return ok(known, "simulated", null, known.id);
      const original = book.records.find((r) => r.id === input.receiptId && r.kind === "sale");
      if (!original) return refuse("not_found");
      if (book.records.some((r) => r.refundOf === original.receiptNumber)) return refuse("conflict");
      if (!DAY.test(input.date) || input.date < original.date || !input.at) return refuse("invalid_input");
      const lines = original.lines.map((line) => ({ ...line, grossMinor: -line.grossMinor }));
      const sequence = book.records.filter((r) => r.business === original.business && r.date === input.date).length + 1;
      const record: RegisterRecord = {
        id: `rcpt-${stableHash(`${original.id}:refund`)}`, register: "demo", kind: "refund",
        receiptNumber: demoReceiptNumber(input.date, sequence), business: original.business, saleId: original.saleId, reference: original.reference,
        date: input.date, at: input.at, currency: original.currency, lines, vat: vatLines(lines),
        totalMinor: -original.totalMinor, prepaidMinor: original.prepaidMinor, paidMinor: -original.paidMinor, method: original.method,
        refundOf: original.receiptNumber,
      };
      commit({
        ...book,
        sales: book.sales.map((s) => (s.id === original.saleId ? { ...s, state: "refunded" as const } : s)),
        records: [...book.records, record],
        keys: remember(input.idempotencyKey, input, record.id),
      });
      return ok(record, "simulated", null, record.id);
    },

    async dailyReport({ business, date }) {
      if (!business || !DAY.test(date)) return refuse("invalid_input");
      const currency = book.records.find((r) => r.business === business)?.currency ?? book.sales.find((s) => s.business === business)?.currency;
      return ok(summariseDay(book.records, business, date, currency ?? "SEK", "demo"), "simulated");
    },
  };
}
