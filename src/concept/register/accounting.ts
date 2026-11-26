import { dailySalesVoucher, type DailySales, type Voucher } from "../connections/ports/accounting";
import { summariseDay, type RegisterMethod, type RegisterRecord } from "../connections/ports/register";
import type { TimeZone } from "../connections/core";

// Register receipts as a day of sales for the bookkeeping. Demo receipts are
// never reported: they are dropped here before anything is summed, so a demo
// sale cannot reach a voucher or an accounting provider.

/** BAS accounts for the day's sales voucher. */
const SALES_ACCOUNT = "3041";
const VAT_ACCOUNTS: Record<number, string> = { 25: "2611", 12: "2621", 6: "2631", 0: "2611" };
const PAYMENT_ACCOUNTS: Record<RegisterMethod | "prepaid", string> = { cash: "1910", card: "1580", swish: "1930", prepaid: "2420" };

export const reportable = (records: readonly RegisterRecord[]) => records.filter((record) => record.register !== "demo");

/** The day's register sales, or null when no reportable receipt exists for it. */
export function registerDailySales(records: readonly RegisterRecord[], business: string, date: string, timeZone: TimeZone): DailySales | null {
  const counted = reportable(records).filter((r) => r.business === business && r.date === date);
  if (!counted.length) return null;
  const { currency } = counted[0];
  const day = summariseDay(counted, business, date, currency, "certified");
  return {
    date, timeZone, currency,
    sales: day.vat.filter((line) => line.grossMinor).map((line) => ({
      account: SALES_ACCOUNT, vatRatePercent: line.ratePercent, vatAccount: VAT_ACCOUNTS[line.ratePercent] ?? VAT_ACCOUNTS[25],
      net: { amountMinor: line.netMinor, currency }, vat: { amountMinor: line.vatMinor, currency },
    })),
    payments: day.methods.filter((m) => m.amountMinor).map((m) => ({ account: PAYMENT_ACCOUNTS[m.method], amount: { amountMinor: m.amountMinor, currency } })),
    reference: `register-${business}-${date}`,
  };
}

/** The balanced voucher for a day of register sales, or null when there is nothing to report. */
export function registerVoucher(records: readonly RegisterRecord[], business: string, date: string, timeZone: TimeZone): Voucher | null {
  const day = registerDailySales(records, business, date, timeZone);
  return day && dailySalesVoucher(day);
}
