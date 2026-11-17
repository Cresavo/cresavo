import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { buildIntentContext } from "@/concept/command/intent-context";
import { clarifyChoices } from "@/concept/command/clarify";
import { proposalFor, type Proposal } from "@/concept/command/proposal";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { interpretCommand } from "@/concept/intent";
import { buildCustomerStats, lowStock, PRODUCTS_ROW, revenueBetween, revenueByMonth, todayRevenue } from "@/concept/selectors";
import { stockForecastTask } from "@/concept/ai/tasks/stock-forecast";
import { overdueOrders, openOrders, readDeliveryNote } from "@/concept/stock/delivery-note";
import { forecastInput, ruleForecast } from "@/concept/stock/forecast";
import { buildOrders, groupBySupplier, purchaseList } from "@/concept/stock/purchase";
import { weeklyUsage } from "@/concept/stock/usage";

const today = "2026-11-16";
const clock = { today, minutes: 12 * 60 };
const state = createDemoState(today);
const stockOf = (s: DemoState, id: string) => s.stock.find((i) => i.id === id)!;
const booked = state.bookings.find((b) => b.status === "booked" && b.date === today && b.serviceId === "basic-foot-care") ?? state.bookings.find((b) => b.status === "booked" && b.serviceId === "basic-foot-care")!;

function order(s: DemoState) {
  const lines = purchaseList(s, today);
  return reduce(s, { type: "stock/order", orders: buildOrders(s, lines, today), at: { date: today, time: clock.minutes } });
}

describe("consumption", () => {
  it("lowers the balance when a visit is marked done, once", () => {
    const done = reduce(state, { type: "booking/complete", id: booked.id });
    expect(done.bookings.find((b) => b.id === booked.id)?.status).toBe("completed");
    expect(stockOf(done, "urea-cream").inStock).toBeCloseTo(stockOf(state, "urea-cream").inStock - 0.2, 5);
    expect(stockOf(done, "gloves").inStock).toBeLessThan(stockOf(state, "gloves").inStock);
    expect(reduce(done, { type: "booking/complete", id: booked.id })).toBe(done);
  });

  it("never goes below zero and ignores treatments without products", () => {
    const empty = { ...state, stock: state.stock.map((s) => ({ ...s, inStock: 0.1 })) };
    expect(stockOf(reduce(empty, { type: "booking/complete", id: booked.id }), "urea-cream").inStock).toBe(0);
    const plain = { ...state, services: state.services.map((s) => ({ ...s, consumption: undefined })) };
    expect(reduce(plain, { type: "booking/complete", id: booked.id }).stock).toEqual(plain.stock);
  });

  it("leaves the stock alone when the stock module is off, and skips cancelled visits", () => {
    const off = { ...state, modules: { ...state.modules, stock: false } };
    expect(reduce(off, { type: "booking/complete", id: booked.id }).stock).toEqual(off.stock);
    const cancelled = reduce(state, { type: "booking/cancel", id: booked.id });
    expect(reduce(cancelled, { type: "booking/complete", id: booked.id })).toBe(cancelled);
  });
});

describe("forecast", () => {
  it("rules give days left and an order that covers delivery plus a week", () => {
    expect(ruleForecast({ product: "Foot cream", quantity: 10, dailyUsage: 2, leadTimeDays: 3 })).toMatchObject({ daysRemaining: 5, orderQuantity: 10 });
    expect(ruleForecast({ product: "Foot cream", quantity: 10, dailyUsage: 0, leadTimeDays: 3 })).toMatchObject({ daysRemaining: null, orderQuantity: 0 });
  });

  it("is the fallback of the stock-forecast task", () => {
    const input = { product: "Oil", quantity: 6, dailyUsage: 0.5, leadTimeDays: 2 };
    expect(stockForecastTask.fallback(input)).toEqual(ruleForecast(input));
  });

  it("derives usage from the last four weeks of finished visits", () => {
    const urea = stockOf(state, "urea-cream");
    const usage = weeklyUsage(state, urea, today);
    expect(usage).toBeGreaterThan(1);
    expect(usage).not.toBe(urea.usagePerWeek);
    const unlinked = weeklyUsage(state, stockOf(state, "surface-disinfectant"), today);
    expect(unlinked).toBe(stockOf(state, "surface-disinfectant").usagePerWeek);
    const input = forecastInput(state, urea, today);
    expect(input).toMatchObject({ product: urea.name, quantity: urea.inStock, leadTimeDays: 3 });
    expect(input.dailyUsage).toBeCloseTo(usage / 7, 2);
  });

  it("counts product sales as usage", () => {
    const item = stockOf(state, "home-foot-cream");
    const sold = reduce(state, { type: "product/sell", customerId: state.customers[0].id, stockId: item.id, quantity: 4, date: today });
    expect(weeklyUsage(sold, item, today)).toBeCloseTo(1, 5);
  });
});

describe("purchase list", () => {
  it("lists what is low with a four-week amount, grouped by supplier", () => {
    const lines = purchaseList(state, today);
    expect(lines.map((l) => l.item.id)).toEqual(lowStock(state).map((i) => i.id));
    expect(lines.every((l) => l.quantity >= 1)).toBe(true);
    const urea = lines.find((l) => l.item.id === "urea-cream")!;
    expect(urea.quantity).toBe(Math.ceil(weeklyUsage(state, urea.item, today) * 4 + urea.item.reorderAt - urea.item.inStock));
    expect(groupBySupplier(lines).map((g) => g.supplier)).toEqual(["Podoshop", "Spagrossisten"]);
  });

  it("approving sends one order and one email draft per supplier and puts the goods on order", () => {
    const next = order(state);
    expect(next.orders).toHaveLength(2);
    expect(next.orders.every((o) => o.status === "open")).toBe(true);
    expect(next.inbox.slice(0, 2).map((i) => i.title)).toEqual(expect.arrayContaining(["Order sent to Podoshop", "Order sent to Spagrossisten"]));
    const mail = next.inbox.find((i) => i.title === "Order sent to Podoshop")!;
    expect(mail.body).toContain("To: orders@podoshop.example");
    expect(mail.body).toContain("Foot cream urea 10%");
    expect(stockOf(next, "urea-cream").onOrder).toBe(purchaseList(state, today).find((l) => l.item.id === "urea-cream")!.quantity);
    expect(lowStock(next)).toEqual([]);
    expect(new Set([...next.orders, ...state.orders].map((o) => o.id)).size).toBe(2);
  });

  it("sends nothing for an empty list", () => {
    expect(reduce(state, { type: "stock/order", orders: [], at: { date: today, time: 0 } })).toBe(state);
    const zero = purchaseList(state, today).map((l) => ({ ...l, quantity: 0 }));
    expect(buildOrders(state, zero, today)).toEqual([]);
  });
});

describe("goods received", () => {
  it("adds what arrived, clears the order and closes it", () => {
    const ordered = order(state);
    const podoshop = ordered.orders.find((o) => o.supplier === "Podoshop")!;
    const before = stockOf(ordered, "urea-cream");
    const note = readDeliveryNote(ordered, podoshop);
    const next = reduce(ordered, { type: "stock/receive", orderId: podoshop.id, deliveries: note.deliveries, date: today });
    expect(stockOf(next, "urea-cream").inStock).toBe(before.inStock + before.onOrder);
    expect(stockOf(next, "urea-cream").onOrder).toBe(0);
    expect(next.orders.find((o) => o.id === podoshop.id)).toMatchObject({ status: "received", receivedOn: today });
    expect(openOrders(next)).toHaveLength(1);
    expect(reduce(next, { type: "stock/receive", orderId: podoshop.id, deliveries: note.deliveries, date: today })).toBe(next);
  });

  it("a short delivery still closes the order", () => {
    const ordered = order(state);
    const podoshop = ordered.orders.find((o) => o.supplier === "Podoshop")!;
    const next = reduce(ordered, { type: "stock/receive", orderId: podoshop.id, deliveries: [{ stockId: "urea-cream", quantity: 5 }], date: today });
    expect(stockOf(next, "urea-cream").inStock).toBe(stockOf(ordered, "urea-cream").inStock + 5);
    expect(stockOf(next, "urea-cream").onOrder).toBe(0);
    expect(next.orders.find((o) => o.id === podoshop.id)?.lines[0].received).toBe(5);
  });

  it("takes a delivery without an order and the predefined note when nothing is on order", () => {
    const note = readDeliveryNote(state);
    expect(note.supplier).toBe("Medicinab");
    const next = reduce(state, { type: "stock/receive", deliveries: note.deliveries, date: today });
    expect(stockOf(next, "gloves").inStock).toBe(stockOf(state, "gloves").inStock + 2);
    expect(reduce(state, { type: "stock/receive", deliveries: [{ stockId: "nope", quantity: 3 }], date: today })).toBe(state);
  });

  it("flags orders whose lead time has passed", () => {
    const ordered = order(state);
    expect(overdueOrders(ordered, today)).toEqual([]);
    expect(overdueOrders(ordered, "2026-11-20").map((o) => o.supplier)).toEqual(["Podoshop"]);
    expect(overdueOrders(ordered, "2026-11-21")).toHaveLength(2);
  });

  it("the whole flow: visit done, warning, approved list, goods in", () => {
    let s = reduce(state, { type: "booking/complete", id: booked.id });
    expect(lowStock(s).map((i) => i.id)).toContain("urea-cream");
    s = order(s);
    expect(lowStock(s)).toEqual([]);
    const o = s.orders.find((x) => x.supplier === "Podoshop")!;
    const low = stockOf(s, "urea-cream").inStock;
    s = reduce(s, { type: "stock/receive", orderId: o.id, deliveries: readDeliveryNote(s, o).deliveries, date: today });
    expect(stockOf(s, "urea-cream").inStock).toBeGreaterThan(low + 10);
  });
});

describe("selling a product", () => {
  const customer = state.customers[0];
  const sell = (s: DemoState, quantity = 1) => reduce(s, { type: "product/sell", customerId: customer.id, stockId: "home-foot-cream", quantity, date: today });

  it("lowers the balance and shows in the customer's spend and in revenue", () => {
    const next = sell(state, 2);
    expect(stockOf(next, "home-foot-cream").inStock).toBe(7);
    expect(next.sales[0]).toMatchObject({ customerId: customer.id, quantity: 2, amount: 438, date: today });
    expect(buildCustomerStats(next, today).get(customer.id)!.spent).toBe(buildCustomerStats(state, today).get(customer.id)!.spent + 438);
    expect(todayRevenue(next, today, 0).earned).toBe(todayRevenue(state, today, 0).earned + 438);
    const month = revenueByMonth(next, today, 1)[0].total;
    expect(month).toBe(revenueByMonth(state, today, 1)[0].total + 438);
    const range = revenueBetween(next, today, 24 * 60, "2026-11-01", "2026-12-01");
    expect(range.byService.find((r) => r.id === PRODUCTS_ROW)?.total).toBe(438);
    expect(range.total).toBe(revenueBetween(state, today, 24 * 60, "2026-11-01", "2026-12-01").total + 438);
  });

  it("refuses unknown customers, products without a price and more than is in stock", () => {
    expect(reduce(state, { type: "product/sell", customerId: "nope", stockId: "home-foot-cream", quantity: 1, date: today })).toBe(state);
    expect(reduce(state, { type: "product/sell", customerId: customer.id, stockId: "urea-cream", quantity: 1, date: today })).toBe(state);
    expect(sell(state, 10)).toBe(state);
    expect(sell(state, 0)).toBe(state);
  });
});

describe("editing a product", () => {
  it("changes minimum level, supplier and prices", () => {
    const next = reduce(state, { type: "stock/update", id: "cuticle-oil", patch: { reorderAt: 20, supplier: "Medicinab", unitCost: 70, salePrice: 129 } });
    expect(stockOf(next, "cuticle-oil")).toMatchObject({ reorderAt: 20, supplier: "Medicinab", unitCost: 70, salePrice: 129 });
    expect(lowStock(next).map((i) => i.id)).toContain("cuticle-oil");
  });
});

describe("command box", () => {
  const context = buildIntentContext(state, today, clock.minutes);
  const examples: string[] = [];
  const propose = (text: string): Proposal => proposalFor(state, interpretCommand(text, context), text, clock, examples);
  const lena = state.customers.filter((c) => c.firstName === "Lena");
  const lenaFull = `${lena[0].firstName} ${lena[0].lastName}`;
  const unique = lena.length === 1;

  it("interprets the three stock phrases", () => {
    expect(interpretCommand("order more foot cream", context)).toMatchObject({ action: "order-stock", params: { product: "foot cream" } });
    expect(interpretCommand("how much massage oil is left?", context)).toMatchObject({ action: "stock-level", params: { product: "massage oil" } });
    expect(interpretCommand("Do I have any foot files left?", context)).toMatchObject({ action: "stock-level", params: { product: "foot files" } });
    expect(interpretCommand(`sold a foot cream to ${lenaFull}`, context)).toMatchObject({ action: "sell-product", params: { product: "foot cream", quantity: 1, customerId: lena[0].id } });
    expect(interpretCommand(`sold 2 glass files to ${lenaFull}`, context)).toMatchObject({ action: "sell-product", params: { product: "glass files", quantity: 2 } });
  });

  it("asks who when the customer is missing or unclear", () => {
    expect(interpretCommand("sold a foot cream to nobody special", context)).toMatchObject({ action: "question" });
    if (!unique) expect(interpretCommand("sold a foot cream to Lena", context)).toMatchObject({ action: "question", question: expect.stringContaining("Which customer") });
  });

  it("lets the owner pick one of several Lenas and then proposes the sale", () => {
    const question = interpretCommand("sold a foot cream to Lena", context);
    if (question.action !== "question") throw new Error("expected a question");
    const choices = clarifyChoices(question.question, "sold a foot cream to Lena", state, today, examples);
    expect(choices.length).toBeGreaterThan(1);
    expect(propose(choices[0].text)).toMatchObject({ kind: "change", action: { type: "product/sell" } });
  });

  it("shows product sales as their own row when asked about revenue", () => {
    const sold = reduce(state, { type: "product/sell", customerId: state.customers[0].id, stockId: "glass-file", quantity: 1, date: today });
    const text = "what have I earned today?";
    const early = { today, minutes: 0 };
    const answer = proposalFor(sold, interpretCommand(text, buildIntentContext(sold, today, 0)), text, early, examples);
    if (answer.kind !== "revenue") throw new Error("expected revenue");
    expect(answer.bars.find((b) => b.label === "Products")?.value).toBe(149);
  });

  it("answers how much is left with the forecast", () => {
    const answer = propose("how much massage oil is left?");
    if (answer.kind !== "stock") throw new Error(`expected a stock answer, got ${answer.kind}`);
    expect(answer.items.map((i) => i.id)).toEqual(["massage-oil-neutral", "massage-oil-eucalyptus"]);
    expect(answer.items[0]).toMatchObject({ left: "1", unit: "1 l bottle", low: true, detail: expect.stringContaining("Runs out in about") });
    expect(propose("how much moonbeam is left?").kind).toBe("message");
  });

  it("drafts a purchase for approval", () => {
    const proposal = propose("order more foot cream");
    if (proposal.kind !== "choose") throw new Error("two foot creams: expected a choice");
    const urea = proposal.choices.find((c) => "proposal" in c && c.label.startsWith("Foot cream urea"));
    if (!urea || !("proposal" in urea) || urea.proposal.kind !== "change" || urea.proposal.action.type !== "stock/order") throw new Error("expected an order");
    const next = reduce(state, urea.proposal.action);
    expect(next.orders).toHaveLength(1);
    expect(stockOf(next, "urea-cream").onOrder).toBeGreaterThan(0);
    expect(next.inbox[0].title).toBe("Order sent to Podoshop");
  });

  it("proposes a sale that the store accepts, and says so when a product is not for sale", () => {
    const proposal = propose(`sold a foot cream to ${lenaFull}`);
    if (proposal.kind !== "change" || proposal.action.type !== "product/sell") throw new Error("expected a sale");
    expect(proposal.action).toMatchObject({ customerId: lena[0].id, stockId: "home-foot-cream", quantity: 1 });
    expect(reduce(state, proposal.action).sales).toHaveLength(1);
    expect(propose(`sold massage oil to ${lenaFull}`)).toMatchObject({ kind: "message", text: expect.stringContaining("not for sale") });
    expect(propose(`sold 30 glass files to ${lenaFull}`)).toMatchObject({ kind: "message", text: expect.stringContaining("Only") });
  });
});
