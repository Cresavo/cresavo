import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { insightFor } from "@/concept/command/insight";
import { interpretCommand } from "@/concept/intent";
import { buildIntentContext } from "@/concept/command/intent-context";
import { commandExamples } from "@/concept/command/examples";
import { proposalFor } from "@/concept/command/proposal";
import { createDemoState } from "@/concept/data/generate";
import { exportRange, salesCsv, salesPerDay, sieFile, vatIn } from "@/concept/finance/accounting";
import { earningsPerHour, figuresFromBookings, monthFigures, occupancy } from "@/concept/finance/figures";
import { buildOverview, changeShare } from "@/concept/finance/overview";
import { periodRanges } from "@/concept/finance/periods";
import { costsByKind, monthResult, recentResults, totalCosts } from "@/concept/finance/profit";
import { utilisation } from "@/concept/selectors";

// A Tuesday afternoon; the demo is generated for this day.
const today = "2026-11-17";
const clock = { today, minutes: 15 * 60 };
const state = createDemoState(today);

describe("period comparisons", () => {
  it("compares the month so far with the same days of the month before", () => {
    const { current, previous } = periodRanges("month", clock);
    expect(current).toMatchObject({ start: "2026-11-01", end: "2026-11-18" });
    expect(previous).toMatchObject({ start: "2026-10-01", end: "2026-10-18" });
  });

  it("compares the week so far with the same weekdays last week, and today with last week's same day", () => {
    const week = periodRanges("week", clock);
    expect(week.current).toMatchObject({ start: "2026-11-16", end: "2026-11-18" });
    expect(week.previous).toMatchObject({ start: "2026-11-09", end: "2026-11-11" });
    const day = periodRanges("day", clock);
    expect(day.previous).toMatchObject({ start: "2026-11-10", end: "2026-11-11", untilMinutes: clock.minutes });
  });

  it("compares the last 12 full months with the 12 before", () => {
    const { current, previous } = periodRanges("year", clock);
    expect(current.months).toHaveLength(12);
    expect(current.months![0]).toBe("2025-11");
    expect(current.months![11]).toBe("2026-10");
    expect(previous.months![0]).toBe("2024-11");
    expect(previous.months![11]).toBe("2025-10");
  });

  it("counts only visits that are over by the cut-off on the last day", () => {
    const early = figuresFromBookings(state, { start: today, end: "2026-11-18", untilMinutes: 9 * 60 }, { today, minutes: 15 * 60 });
    const late = figuresFromBookings(state, { start: today, end: "2026-11-18", untilMinutes: 15 * 60 }, { today, minutes: 15 * 60 });
    expect(early.visits).toBeLessThan(late.visits);
    expect(early.revenue).toBeLessThan(late.revenue);
  });

  it("builds an overview with every figure next to the period before", () => {
    for (const period of ["day", "week", "month", "year"] as const) {
      const overview = buildOverview(state, period, clock);
      expect(overview.current.revenue).toBeGreaterThan(0);
      expect(overview.previous.revenue).toBeGreaterThan(0);
      expect(overview.occupancy.current.byStaff.map((p) => p.id)).toEqual(["anna", "erik"]);
      expect(overview.treatments.length).toBeGreaterThan(0);
    }
    const month = buildOverview(state, "month", clock);
    expect(month.series.current).toHaveLength(17);
    expect(month.series.current.reduce((a, b) => a + b, 0)).toBe(month.current.revenue);
    expect(buildOverview(state, "day", clock).series.current).toEqual([]);
  });

  it("uses saved monthly totals for months before the bookings start", () => {
    const old = monthFigures(state, "2026-03", clock);
    expect(old).toEqual(state.monthHistory.find((m) => m.month === "2026-03"));
    expect(old.revenue).toBeGreaterThan(0);
    expect(monthFigures(state, "2026-09", clock).revenue).toBe(figuresFromBookings(state, { start: "2026-09-01", end: "2026-10-01" }, clock).revenue);
  });

  it("describes a change as a share, or nothing when there is nothing to compare with", () => {
    expect(changeShare(150, 100)).toBeCloseTo(0.5);
    expect(changeShare(50, 100)).toBeCloseTo(-0.5);
    expect(changeShare(10, 0)).toBeNull();
  });
});

describe("occupancy and earnings per hour", () => {
  it("measures occupancy per person over the range", () => {
    const range = { start: "2026-11-23", end: "2026-11-30" };
    const result = occupancy(state, range);
    expect(result.byStaff[1].value).toBeCloseTo(utilisation(state, range.start, 7, "erik"));
    expect(result.all).toBeGreaterThan(0);
    expect(result.all).toBeLessThanOrEqual(1);
  });

  it("ranks treatments by revenue per hour of treatment time", () => {
    const range = { start: "2026-08-19", end: "2026-11-18" };
    const rows = earningsPerHour(state, range, clock);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.map((r) => r.perHour)).toEqual([...rows.map((r) => r.perHour)].sort((a, b) => b - a));
    const service = state.services.find((s) => s.id === rows[0].id)!;
    expect(rows[0].perHour).toBeCloseTo((service.price / service.duration) * 60, 0);
  });
});

describe("costs and profit", () => {
  it("subtracts the monthly costs from a full month's revenue", () => {
    const result = monthResult(state, "2026-10", clock);
    expect(result.costs).toBe(totalCosts(state.costs));
    expect(result.profit).toBe(result.revenue - result.costs);
    expect(recentResults(state, clock, 6).map((r) => r.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("adds and removes costs through the store actions and ignores empty ones", () => {
    const added = reduce(state, { type: "cost/add", kind: "other", label: "Cleaning", amount: 1500 });
    expect(totalCosts(added.costs)).toBe(totalCosts(state.costs) + 1500);
    expect(monthResult(added, "2026-10", clock).profit).toBe(monthResult(state, "2026-10", clock).profit - 1500);
    expect(costsByKind(added.costs).find((r) => r.kind === "other")?.amount).toBe(1500);
    expect(reduce(added, { type: "cost/remove", id: added.costs.at(-1)!.id }).costs).toEqual(state.costs);
    expect(reduce(state, { type: "cost/add", kind: "rent", label: "Rent", amount: 0 })).toBe(state);
    expect(reduce(state, { type: "cost/add", kind: "rent", label: " ", amount: 100 })).toBe(state);
  });

  it("connects and disconnects the simulated bookkeeping", () => {
    const connected = reduce(state, { type: "accounting/connect", on: today });
    expect(connected.accounting).toEqual({ connected: true, connectedOn: today });
    expect(reduce(connected, { type: "accounting/disconnect" }).accounting).toEqual({ connected: false });
  });
});

describe("bookkeeping export", () => {
  it("splits a price into net and 25% VAT", () => {
    expect(vatIn(1250)).toBe(250);
    expect(vatIn(790)).toBe(158);
  });

  it("lists sales per day with VAT, matching the revenue", () => {
    const range = exportRange(clock);
    expect(range).toEqual({ start: "2026-08-01", end: "2026-11-01" });
    const days = salesPerDay(state, range, clock);
    expect(days.reduce((sum, d) => sum + d.gross, 0)).toBe(figuresFromBookings(state, range, clock).revenue);
    for (const day of days) expect(day.net + day.vat).toBeCloseTo(day.gross);
    expect(days.map((d) => d.date)).toEqual(days.map((d) => d.date).sort());
  });

  it("writes a CSV with one row per day of sales", () => {
    const lines = salesCsv(state, clock).split("\n");
    expect(lines[0]).toBe("date,visits,sales_ex_vat_sek,vat_sek,total_sek");
    expect(lines).toHaveLength(salesPerDay(state, exportRange(clock), clock).length + 1);
    expect(lines[1]).toMatch(/^2026-08-\d\d,\d+,\d+\.\d\d,\d+\.\d\d,\d+\.\d\d$/);
  });

  it("writes a SIE file whose vouchers all balance", () => {
    const sie = sieFile(state, clock);
    expect(sie.startsWith("#FLAGGA 0\r\n#PROGRAM \"Flerdo\" 1.0\r\n#FORMAT PC8\r\n#GEN 20261117\r\n#SIETYP 4\r\n")).toBe(true);
    expect(sie).toContain("#RAR 0 20260801 20261031");
    expect(sie).toContain('#KONTO 1930 "Business account"');
    const vouchers = [...sie.matchAll(/#VER A (\d+) (\d{8}) "([^"]+)"\r\n\{\r\n([\s\S]*?)\r\n\}/g)];
    const sales = salesPerDay(state, exportRange(clock), clock);
    expect(vouchers).toHaveLength(sales.length + state.costs.length * 3);
    expect(vouchers.map((v) => Number(v[1]))).toEqual(vouchers.map((_, i) => i + 1));
    for (const [, , , , body] of vouchers) {
      const amounts = [...body.matchAll(/^#TRANS \d+ \{\} (-?\d+\.\d\d)$/gm)].map((m) => Math.round(Number(m[1]) * 100));
      expect(amounts.length).toBeGreaterThanOrEqual(2);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(0);
    }
    const first = vouchers.find((v) => v[3] === `Sales ${sales[0].date}`)!;
    expect(first[4]).toContain(`#TRANS 1930 {} ${sales[0].gross.toFixed(2)}`);
    expect(first[4]).toContain(`#TRANS 2611 {} -${sales[0].vat.toFixed(2)}`);
  });
});

describe("command box questions about the numbers", () => {
  const context = buildIntentContext(state, today, clock.minutes);
  const examples = commandExamples(state, today);
  const answer = (text: string) => proposalFor(state, interpretCommand(text, context), text, clock, examples);

  it("compares March with the same month last year", () => {
    const insight = insightFor(state, "Compare March with last year", clock)!;
    const march = monthFigures(state, "2026-03", clock).revenue;
    const before = monthFigures(state, "2025-03", clock).revenue;
    expect(insight.title).toBe("March 2026 compared with March 2025");
    expect(insight.chart.data.map((d) => d.value)).toEqual([before, march]);
    expect(insight.value).toBe(`${march >= before ? "+" : "−"}${Math.abs(Math.round((march / before - 1) * 100))}%`);
    expect(answer("compare March with last year")).toMatchObject({ kind: "insight" });
  });

  it("compares two named months and this month with last month", () => {
    expect(insightFor(state, "compare October with September", clock)!.chart.data.map((d) => d.id)).toEqual(["2026-09", "2026-10"]);
    expect(insightFor(state, "compare this month with last month", clock)!.chart.data.map((d) => d.id)).toEqual(["2026-10", "2026-11"]);
  });

  it("names the treatment that earns the most per hour, with every treatment in the chart", () => {
    const insight = answer("which treatment earns the most per hour?");
    expect(insight.kind).toBe("insight");
    if (insight.kind !== "insight") return;
    const top = earningsPerHour(state, { start: "2026-08-19", end: "2026-11-18" }, clock)[0];
    expect(insight.chart.data[0].id).toBe(top.id);
    expect(insight.chart.data[0].value).toBeCloseTo(top.perHour);
    expect(insight.title).toContain(state.services.find((s) => s.id === top.id)!.name);
    expect(insight.chart.unit).toBe("moneyPerHour");
  });

  it("answers how busy Erik is next week with one share and a column per day", () => {
    const insight = answer("how busy is Erik next week?");
    expect(insight.kind).toBe("insight");
    if (insight.kind !== "insight") return;
    expect(insight.title).toBe("How busy is Erik next week");
    expect(insight.value).toBe(`${Math.round(utilisation(state, "2026-11-23", 7, "erik") * 100)}%`);
    expect(insight.chart.data.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(insightFor(state, "how busy are we this week", clock)!.title).toBe("How busy is everyone this week");
  });

  it("leaves other questions alone", () => {
    expect(insightFor(state, "How much did I make this month?", clock)).toBeNull();
    expect(answer("How much did I make this month?").kind).toBe("revenue");
  });
});
