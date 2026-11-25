import { BRAND } from "../brand";
import { addDays } from "../data/dates";
import type { DemoState } from "../data/types";
import { toCsv } from "../studio/more/export";
import { countsIn } from "./figures";
import { monthRange, monthStart, shiftMonth, type Range } from "./periods";
import type { Clock, CostKind } from "./types";

// What would be sent to the bookkeeping: sales per day with VAT, and the monthly
// costs. Amounts are counted in öre so that every voucher balances exactly.

/** The demo assumes 25% VAT included in every price. */
export const VAT_PERCENT = 25;
export const EXPORT_MONTHS = 3;

const BANK = 1930;
const SALES = 3041;
const OUTPUT_VAT = 2611;
const COST_ACCOUNTS: Record<CostKind, { number: number; name: string }> = {
  rent: { number: 5010, name: "Rent" },
  products: { number: 4010, name: "Products and supplies" },
  wages: { number: 7010, name: "Wages" },
  fees: { number: 6570, name: "Fees" },
  other: { number: 6990, name: "Other costs" },
};

export interface SalesDay {
  date: string;
  visits: number;
  /** Amounts use the salon currency. */
  gross: number;
  vat: number;
  net: number;
}

/** VAT inside a price that already includes it. */
export function vatIn(gross: number): number {
  return Math.round((gross * 100 * VAT_PERCENT) / (100 + VAT_PERCENT)) / 100;
}

/** One row per day that had finished visits, oldest first. */
export function salesPerDay(state: DemoState, range: Range, clock: Clock): SalesDay[] {
  const days = new Map<string, { gross: number; visits: number }>();
  for (const b of state.bookings) {
    if (!countsIn(b, range, clock)) continue;
    const row = days.get(b.date) ?? { gross: 0, visits: 0 };
    row.gross += b.price;
    row.visits += 1;
    days.set(b.date, row);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date, visits: row.visits, gross: row.gross, vat: vatIn(row.gross), net: row.gross - vatIn(row.gross) }));
}

/** The last full months that the exports cover. */
export function exportRange(clock: Clock): Range {
  const last = shiftMonth(clock.today.slice(0, 7), -1);
  return { start: monthRange(shiftMonth(last, 1 - EXPORT_MONTHS)).start, end: monthRange(last).end };
}

const ore = (sek: number) => Math.round(sek * 100);
const amount = (cents: number) => (cents / 100).toFixed(2);
const compactDate = (date: string) => date.replaceAll("-", "");

export function salesCsv(state: DemoState, clock: Clock): string {
  const unit = state.localization.currency.toLowerCase();
  return toCsv([
    ["date", "visits", `sales_ex_vat_${unit}`, `vat_${unit}`, `total_${unit}`],
    ...salesPerDay(state, exportRange(clock), clock).map((d) => [d.date, d.visits, d.net.toFixed(2), d.vat.toFixed(2), d.gross.toFixed(2)]),
  ]);
}

/** A bookkeeping file in SIE type 4 (the Swedish standard): one voucher per day of sales and one per month of costs. */
export function sieFile(state: DemoState, clock: Clock): string {
  const range = exportRange(clock);
  const vouchers: { date: string; text: string; rows: [number, number][] }[] = [
    ...salesPerDay(state, range, clock).map((d) => ({
      date: d.date,
      text: `Sales ${d.date}`,
      rows: [[BANK, ore(d.gross)], [SALES, -ore(d.net)], [OUTPUT_VAT, -ore(d.vat)]] as [number, number][],
    })),
    ...monthsOf(range).flatMap((month) =>
      state.costs.map((c) => ({
        date: addDays(monthStart(shiftMonth(month, 1)), -1),
        text: `${c.label} ${month}`,
        rows: [[COST_ACCOUNTS[c.kind].number, ore(c.amount)], [BANK, -ore(c.amount)]] as [number, number][],
      })),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const accounts = new Map<number, string>([
    [BANK, "Business account"],
    [SALES, "Sales of services, 25% VAT"],
    [OUTPUT_VAT, "Output VAT 25%"],
    ...Object.values(COST_ACCOUNTS).map((a) => [a.number, a.name] as [number, string]),
  ]);
  const lines = [
    "#FLAGGA 0",
    `#PROGRAM "${BRAND.name}" 1.0`,
    "#FORMAT PC8",
    `#GEN ${compactDate(clock.today)}`,
    "#SIETYP 4",
    `#VALUTA ${state.localization.currency}`,
    `#ORGNR ${state.salon.orgNumber}`,
    `#FNAMN "${state.salon.name}"`,
    `#RAR 0 ${compactDate(range.start)} ${compactDate(addDays(range.end, -1))}`,
    ...[...accounts.entries()].sort(([a], [b]) => a - b).map(([number, name]) => `#KONTO ${number} "${name}"`),
    ...vouchers.flatMap((v, i) => [
      `#VER A ${i + 1} ${compactDate(v.date)} "${v.text}"`,
      "{",
      ...v.rows.map(([account, cents]) => `#TRANS ${account} {} ${amount(cents)}`),
      "}",
    ]),
  ];
  return lines.join("\r\n") + "\r\n";
}

function monthsOf(range: Range): string[] {
  const months: string[] = [];
  for (let month = range.start.slice(0, 7); monthStart(month) < range.end; month = shiftMonth(month, 1)) months.push(month);
  return months;
}
