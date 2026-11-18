import type { Adapter, Money, PortResult, TimeZone } from "../core";

export type AccountingCapability = "voucher" | "daily-sales" | "idempotency";

export interface VoucherRow {
  /** Account in the business's chart of accounts, e.g. "3001" (BAS) or "200" (Xero). */
  account: string;
  /** Minor units; exactly one of debit or credit is above zero. */
  debitMinor: number;
  creditMinor: number;
  description?: string;
}

export interface Voucher {
  /** Business-local calendar day, YYYY-MM-DD. */
  date: string;
  description: string;
  currency: string;
  rows: VoucherRow[];
  /** Provider voucher series where the provider has them (Fortnox "A"). */
  series?: string;
  /** Our own id; providers without idempotency get it in the description so duplicates are findable. */
  reference: string;
}

export interface DailySales {
  date: string;
  timeZone: TimeZone;
  currency: string;
  /** Net sales per VAT rate. */
  sales: { account: string; vatRatePercent: number; net: Money; vat: Money; vatAccount: string }[];
  /** How the day was paid. */
  payments: { account: string; amount: Money }[];
  reference: string;
}

export interface VoucherReceipt {
  id: string;
  series?: string;
}

export interface AccountingPort extends Adapter<AccountingCapability> {
  postVoucher(voucher: Voucher): Promise<PortResult<VoucherReceipt>>;
}

/** A balanced voucher for one day of sales. Throws when debit and credit differ, so nothing unbalanced reaches a provider. */
export function dailySalesVoucher(day: DailySales): Voucher {
  const rows: VoucherRow[] = [];
  for (const payment of day.payments) rows.push({ account: payment.account, debitMinor: payment.amount.amountMinor, creditMinor: 0 });
  for (const sale of day.sales) {
    rows.push({ account: sale.account, debitMinor: 0, creditMinor: sale.net.amountMinor, description: `Sales ${sale.vatRatePercent}%` });
    if (sale.vat.amountMinor > 0) rows.push({ account: sale.vatAccount, debitMinor: 0, creditMinor: sale.vat.amountMinor, description: `VAT ${sale.vatRatePercent}%` });
  }
  const amounts = [...day.payments.map((p) => p.amount), ...day.sales.flatMap((s) => [s.net, s.vat])];
  if (amounts.some((m) => m.currency !== day.currency)) throw new Error("Mixed currencies in daily sales");
  if (!isBalanced(rows)) throw new Error("Daily sales voucher is not balanced");
  return { date: day.date, description: `Daily sales ${day.date}`, currency: day.currency, rows, reference: day.reference };
}

/** Description with the reference kept whole: the description is cut, never the reference. */
export function describeVoucher(voucher: Pick<Voucher, "description" | "reference">, max = 200): string {
  const suffix = ` [${voucher.reference}]`;
  return `${voucher.description.slice(0, Math.max(0, max - suffix.length))}${suffix}`;
}

export function isBalanced(rows: VoucherRow[]): boolean {
  const debit = rows.reduce((sum, r) => sum + r.debitMinor, 0);
  const credit = rows.reduce((sum, r) => sum + r.creditMinor, 0);
  return rows.length >= 2 && debit === credit && debit > 0 &&
    rows.every((r) => Number.isSafeInteger(r.debitMinor) && Number.isSafeInteger(r.creditMinor) && r.debitMinor >= 0 && r.creditMinor >= 0 && (r.debitMinor > 0) !== (r.creditMinor > 0));
}
