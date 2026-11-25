import { moduleEnabled } from "../modules/registry";
import { majorString } from "../connections/core";
import type { Booking, DemoState } from "../data/types";
import { paidWithCards } from "../giftcards/cards";
import { locale, t } from "../i18n";
import { paymentBalance, toMinor, type BookingTerms } from "./protection";

export function formatMinor(amountMinor: number, currency: string) {
  const major = Number(majorString({ amountMinor, currency }));
  // Whole amounts read like the price list (795 kr); fractional amounts keep the currency's precision.
  const whole = Number.isInteger(major) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  return new Intl.NumberFormat(locale, { style: "currency", currency, ...whole }).format(major);
}

export function policyText(terms: BookingTerms) {
  if (!terms.latePercent && !terms.noShowPercent) return t("protection.feeFree", { hours: terms.freeHours });
  return t("protection.terms", { hours: terms.freeHours, late: terms.latePercent, missed: terms.noShowPercent });
}

export function PolicySummary({ terms }: { terms: BookingTerms }) {
  return <div className="space-y-1 text-meta">
    <p>{policyText(terms)}</p>
    <p>{!terms.depositMinor ? t("protection.noDeposit") : terms.depositMinor >= terms.priceMinor ? t("protection.dueFull", { amount: formatMinor(terms.depositMinor, terms.currency) }) : t("protection.due", {
      deposit: formatMinor(terms.depositMinor, terms.currency), balance: formatMinor(terms.priceMinor - terms.depositMinor, terms.currency),
    })}</p>
    {terms.depositMinor > 0 && <p className="text-text-secondary">{t("protection.simulated")}</p>}
  </div>;
}

/** `note`: the owner's own views say the money is simulated; the customer's confirmation does not. */
export function PaymentSummary({ booking, state, active = booking.status === "booked", note }: { booking: Booking; state: DemoState; active?: boolean; note?: boolean }) {
  const protection = booking.protection;
  if (!protection) return null;
  const { currency } = protection.terms;
  if (booking.status === "completed" && state.packages.some(pkg => pkg.usedBy.includes(booking.id))) {
    return <p>{t("packages.paid", { amount: formatMinor(toMinor(booking.price, currency), currency) })}</p>;
  }
  const ended = booking.status === "noshow" || booking.status === "cancelled";
  const balance = paymentBalance(protection, ended, toMinor(paidWithCards(state, booking.id), currency));
  const money = (n: number) => formatMinor(n, currency);
  if (!balance.deposit && !balance.paid && !balance.refund && !protection.decision) {
    return <p className="border-t border-hairline pt-3 text-meta"><strong>{money(balance.remaining)}</strong>{active && <> · {t(moduleEnabled(state.modules, "packages") ? "booking.payAtSalonWithPackages" : "booking.payAtSalon")}</>}</p>;
  }
  return <div className="space-y-1 text-meta">
    <p>{t("protection.balance", { deposit: money(balance.deposit), paid: money(balance.paid), remaining: money(balance.remaining) })}</p>
    {protection.decision && <p>{t("protection.feeTotal", { amount: money(protection.decision.outcome === "charge" ? protection.decision.proposedMinor : 0) })}</p>}
    {protection.decision && <p>{t(protection.decision.outcome === "waive" ? "protection.waived" : "protection.charged")}</p>}
    {balance.refund > 0 && <p>{t("protection.refunded", { amount: money(balance.refund) })}</p>}
    {note && (protection.deposit || protection.decision) && <p className="text-text-secondary">{t("protection.simulated")}</p>}
  </div>;
}
