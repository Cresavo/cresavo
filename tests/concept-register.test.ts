import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { billableVisit, dueOf, settle, type BillableVisit } from "@/concept/booking/settle";
import { quote } from "@/concept/booking/protection";
import { isBalanced } from "@/concept/connections/ports/accounting";
import { cashChange, demoReceiptNumber, summariseDay, vatLines, type RegisterRecord } from "@/concept/connections/ports/register";
import { stripePayments } from "@/concept/connections/providers/payments/stripe";
import { simulatedPayments } from "@/concept/connections/simulated/adapters";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { demoRegister } from "@/concept/connections/simulated/register";
import { createDemoState } from "@/concept/data/generate";
import { registerDailySales, registerVoucher } from "@/concept/register/accounting";
import { minorFromInput } from "@/concept/register/cash";
import { createRegister, demoRegisterAllowed } from "@/concept/register/factory";
import { Receipt } from "@/concept/studio/register/receipt";

const day = "2026-11-25";
const at = "2026-11-25T10:00:00Z";
const visit = (reference = "b-1", overrides: Partial<BillableVisit> = {}): BillableVisit => ({
  business: "salong-eko", reference, currency: "SEK", date: day, prepaidMinor: 0,
  lines: [{ description: "Haircut", grossMinor: 79500, vatRatePercent: 25 }], ...overrides,
});
const simulated = () => simulatedPayments({ outbox: createOutbox() });
const live = stripePayments({ secretKey: "sk_test_invented", fetch: () => Promise.reject(new Error("no network in tests")) });

describe("register guard", () => {
  it("hands out the demo register only to a browser demo salon on simulated payments", () => {
    expect(demoRegisterAllowed({ workspace: "demo", payments: simulated() })).toBe(true);
    expect(demoRegisterAllowed({ workspace: "own", payments: simulated() })).toBe(true);
    expect(demoRegisterAllowed({ workspace: "account", payments: simulated() })).toBe(false);
    expect(demoRegisterAllowed({ workspace: "demo", payments: live })).toBe(false);
    expect(demoRegisterAllowed({ workspace: "demo", payments: simulated(), live: true })).toBe(false);
  });

  it("refuses every call for a real account, whatever the caller asks for", async () => {
    const register = createRegister({ workspace: "account", payments: simulated() });
    expect(register.info.kind).toBe("unavailable");
    const started = await register.startSale({ ...visit(), idempotencyKey: "k" });
    expect(started).toMatchObject({ ok: false, error: { code: "not_configured" } });
    const paid = await settle(visit(), { channel: "in-salon", method: "card", at }, { payments: live, register });
    expect(paid.ok).toBe(false);
    expect(register.receipts("salong-eko")).toEqual([]);
  });

  it("tags every receipt as demo", async () => {
    const register = createRegister({ workspace: "demo", payments: simulated() });
    await settle(visit(), { channel: "in-salon", method: "swish", at }, { payments: simulated(), register });
    expect(register.receipts("salong-eko").map((r) => r.register)).toEqual(["demo"]);
  });
});

describe("settle routing", () => {
  it("sends an online intent to the payments port and leaves the register alone", async () => {
    const register = demoRegister();
    const createCheckout = vi.fn(simulated().createCheckout);
    const result = await settle(visit("b-1", { prepaidMinor: 20000 }), { channel: "online", method: "card", successUrl: "", cancelUrl: "", idempotencyKey: "b-1-online" }, { payments: { createCheckout }, register });
    expect(result).toMatchObject({ ok: true, channel: "online" });
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: { amountMinor: 59500, currency: "SEK" }, reference: "b-1", methods: ["card"] }));
    expect(register.receipts("salong-eko")).toEqual([]);
  });

  it("sends an in-salon intent to the register and never to the payments port", async () => {
    const register = demoRegister();
    const createCheckout = vi.fn();
    const result = await settle(visit("b-1", { prepaidMinor: 20000 }), { channel: "in-salon", method: "card", at }, { payments: { createCheckout }, register });
    expect(createCheckout).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, channel: "in-salon", receipt: { paidMinor: 59500, prepaidMinor: 20000, totalMinor: 79500, method: "card" } });
  });

  it("takes one payment per visit: a second attempt is refused and issues no receipt", async () => {
    const register = demoRegister();
    const ports = { payments: simulated(), register };
    expect((await settle(visit(), { channel: "in-salon", method: "card", at }, ports)).ok).toBe(true);
    expect((await settle(visit(), { channel: "in-salon", method: "swish", at }, ports)).ok).toBe(false);
    expect(register.receipts("salong-eko")).toHaveLength(1);
  });

  it("leaves a pending payment without a receipt until it is confirmed", async () => {
    const register = demoRegister();
    const result = await settle(visit(), { channel: "in-salon", method: "swish", pending: true, at }, { payments: simulated(), register });
    if (!result.ok || result.channel !== "in-salon") throw new Error("expected a register payment");
    expect(result.payment.state).toBe("pending");
    expect(result.receipt).toBeUndefined();
    const confirmed = await register.completePayment({ paymentId: result.payment.id, outcome: "paid", at });
    expect(confirmed).toMatchObject({ ok: true, value: { payment: { state: "completed" }, receipt: { receiptNumber: "DEMO-20261125-0001" } } });
  });

  it("deducts a paid deposit and gift cards from the visit, but not a refunded deposit", () => {
    const state = createDemoState(day);
    const service = { ...state.services[0], price: 500 };
    const terms = quote({ ...state.cancellationPolicy, deposits: { [service.id]: 15000 } }, service, "SEK", true);
    const booking = { ...state.bookings[0], serviceId: service.id, price: 500, status: "booked" as const, protection: { terms, deposit: { id: "dep", method: "card" as const } } };
    expect(dueOf(billableVisit(state, booking, day))).toBe(35000);
    expect(dueOf(billableVisit(state, { ...booking, protection: { ...booking.protection, refund: { id: "r", amountMinor: 15000 } } }, day))).toBe(50000);
  });
});

describe("cash", () => {
  it("computes change in exact minor units", () => {
    expect(cashChange(59550, 60000)).toBe(450);
    expect(cashChange(59550, 59550)).toBe(0);
    expect(cashChange(59550, 59549)).toBeNull();
  });

  it("parses a typed amount without floating point", () => {
    expect(minorFromInput("600", "SEK")).toBe(60000);
    expect(minorFromInput("595,50", "SEK")).toBe(59550);
    expect(minorFromInput("1 000.5", "SEK")).toBe(100050);
    expect(minorFromInput("0.1", "SEK")).toBe(10);
    expect(minorFromInput("1,234", "SEK")).toBeNull();
    expect(minorFromInput("abc", "SEK")).toBeNull();
    expect(minorFromInput("", "SEK")).toBeNull();
  });

  it("records what was received and the change, and refuses too little", async () => {
    const register = demoRegister();
    const ports = { payments: simulated(), register };
    expect((await settle(visit(), { channel: "in-salon", method: "cash", tenderedMinor: 79000, at }, ports)).ok).toBe(false);
    const paid = await settle(visit(), { channel: "in-salon", method: "cash", tenderedMinor: 100000, at }, ports);
    expect(paid).toMatchObject({ ok: true, receipt: { tenderedMinor: 100000, changeMinor: 20500, paidMinor: 79500 } });
  });
});

describe("receipts", () => {
  it("numbers receipts per business and day, refunds included", async () => {
    const register = demoRegister();
    const ports = { payments: simulated(), register };
    await settle(visit("b-1"), { channel: "in-salon", method: "card", at }, ports);
    await settle(visit("b-2"), { channel: "in-salon", method: "swish", at }, ports);
    await settle(visit("b-3", { business: "other-salon" }), { channel: "in-salon", method: "card", at }, ports);
    await settle(visit("b-4", { date: "2026-11-26" }), { channel: "in-salon", method: "card", at }, ports);
    const [first] = register.receipts("salong-eko");
    const refund = await register.refund({ receiptId: first.id, date: day, at, idempotencyKey: "r-1" });
    expect(register.receipts("salong-eko").map((r) => r.receiptNumber)).toEqual(["DEMO-20261125-0001", "DEMO-20261125-0002", "DEMO-20261126-0001", "DEMO-20261125-0003"]);
    expect(register.receipts("other-salon").map((r) => r.receiptNumber)).toEqual(["DEMO-20261125-0001"]);
    expect(refund).toMatchObject({ ok: true, value: { kind: "refund", refundOf: "DEMO-20261125-0001", paidMinor: -79500 } });
    expect((await register.refund({ receiptId: first.id, date: day, at, idempotencyKey: "r-2" })).ok).toBe(false);
    expect(demoReceiptNumber("2026-01-02", 12)).toBe("DEMO-20260102-0012");
  });

  it("splits VAT per rate and rounds to a minor unit", () => {
    expect(vatLines([{ grossMinor: 79500, vatRatePercent: 25 }, { grossMinor: 10000, vatRatePercent: 12 }, { grossMinor: 5000, vatRatePercent: 25 }])).toEqual([
      { ratePercent: 25, grossMinor: 84500, netMinor: 67600, vatMinor: 16900 },
      { ratePercent: 12, grossMinor: 10000, netMinor: 8929, vatMinor: 1071 },
    ]);
  });

  it("shows the DEMO watermark and number on a demo receipt", async () => {
    const register = demoRegister();
    const result = await settle(visit(), { channel: "in-salon", method: "card", at }, { payments: simulated(), register });
    if (!result.ok || result.channel !== "in-salon" || !result.receipt) throw new Error("expected a receipt");
    const html = renderToStaticMarkup(createElement(Receipt, { record: result.receipt, salon: createDemoState(day).salon }));
    expect(html).toContain("DEMO-20261125-0001");
    expect(html).toMatch(/aria-hidden="true"[^>]*>.*DEMO<\/span>/);
  });
});

describe("daily report and bookkeeping", () => {
  const takeDay = async () => {
    const register = demoRegister();
    const ports = { payments: simulated(), register };
    await settle(visit("b-1", { prepaidMinor: 20000 }), { channel: "in-salon", method: "card", at }, ports);
    await settle(visit("b-2"), { channel: "in-salon", method: "cash", tenderedMinor: 80000, at }, ports);
    await settle(visit("b-3"), { channel: "in-salon", method: "swish", at }, ports);
    const swish = register.receipts("salong-eko")[2];
    await register.refund({ receiptId: swish.id, date: day, at, idempotencyKey: "r" });
    return register;
  };

  it("sums the day per method and VAT rate, net of refunds", async () => {
    const register = await takeDay();
    const report = await register.dailyReport({ business: "salong-eko", date: day });
    if (!report.ok) throw new Error("expected a report");
    expect(report.value).toMatchObject({ receipts: 3, refunds: 1, totalMinor: 159000, register: "demo" });
    expect(Object.fromEntries(report.value.methods.map((m) => [m.method, m.amountMinor]))).toEqual({ card: 59500, prepaid: 20000, cash: 79500, swish: 0 });
    expect(report.value.vat).toEqual([{ ratePercent: 25, grossMinor: 159000, netMinor: 127200, vatMinor: 31800 }]);
  });

  it("keeps demo receipts out of the accounting export", async () => {
    const records = (await takeDay()).receipts("salong-eko");
    expect(registerDailySales(records, "salong-eko", day, "Europe/Stockholm")).toBeNull();
    expect(registerVoucher(records, "salong-eko", day, "Europe/Stockholm")).toBeNull();
  });

  it("exports the same day from a certified register as a balanced voucher", async () => {
    const records: RegisterRecord[] = (await takeDay()).receipts("salong-eko").map((r) => ({ ...r, register: "certified" }));
    const voucher = registerVoucher(records, "salong-eko", day, "Europe/Stockholm");
    expect(voucher && isBalanced(voucher.rows)).toBe(true);
    const mixed = [...records.slice(0, 1), ...records.slice(1).map((r) => ({ ...r, register: "demo" as const }))];
    expect(registerDailySales(mixed, "salong-eko", day, "Europe/Stockholm")?.payments).toEqual([
      { account: "1580", amount: { amountMinor: 59500, currency: "SEK" } },
      { account: "2420", amount: { amountMinor: 20000, currency: "SEK" } },
    ]);
    expect(summariseDay(mixed, "salong-eko", day, "SEK", "certified").receipts).toBe(3);
  });
});
