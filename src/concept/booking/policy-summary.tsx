import { majorString } from "../connections/core";
import type { Booking, DemoState } from "../data/types";
import { paidWithCards } from "../giftcards/cards";
import { locale, t } from "../i18n";
import { formatDate, formatTime } from "../i18n/format";
import { deadline } from "./policy";
import { paymentBalance, toMinor, type BookingTerms } from "./protection";

export function formatMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(majorString({ amountMinor, currency })));
}

export function deadlineText(visit: Pick<Booking, "date" | "start">, freeHours: number) {
  const until = deadline(visit, freeHours);
  return t("booking.freeUntil", { day: formatDate(until.toISODate()!), time: formatTime(until.hour * 60 + until.minute) });
}

export function policyText(terms: BookingTerms) {
  if (!terms.latePercent && !terms.noShowPercent) return t("protection.feeFree", { hours: terms.freeHours });
  return t("protection.terms", { hours: terms.freeHours, late: terms.latePercent, missed: terms.noShowPercent });
}

export function PolicySummary({ terms, visit }: { terms: BookingTerms; visit?: Pick<Booking, "date" | "start"> }) {
  return <div className="space-y-1 text-sm">
    <p>{policyText(terms)}</p>
    {visit && <p>{deadlineText(visit, terms.freeHours)}</p>}
    <p>{terms.depositMinor ? t("protection.due", {
      deposit: formatMinor(terms.depositMinor, terms.currency), balance: formatMinor(terms.priceMinor - terms.depositMinor, terms.currency),
    }) : t("protection.noDeposit")}</p>
    {terms.depositMinor > 0 && <p className="text-text-secondary">{t("protection.simulated")}</p>}
  </div>;
}

export function PaymentSummary({ booking, state }: { booking: Booking; state: DemoState }) {
  const protection = booking.protection;
  if (!protection) return null;
  const { currency } = protection.terms;
  if (booking.status === "completed" && state.packages.some(pkg => pkg.usedBy.includes(booking.id))) {
    return <p>{t("packages.paid", { amount: formatMinor(toMinor(booking.price, currency), currency) })}</p>;
  }
  const ended = booking.status === "noshow" || booking.status === "cancelled";
  const balance = paymentBalance(protection, ended, toMinor(paidWithCards(state, booking.id), currency));
  const money = (n: number) => formatMinor(n, currency);
  return <div className="space-y-1 text-sm">
    <p>{t("protection.balance", { deposit: money(balance.deposit), paid: money(balance.paid), remaining: money(balance.remaining) })}</p>
    {protection.decision && <p>{t("protection.feeTotal", { amount: money(protection.decision.outcome === "charge" ? protection.decision.proposedMinor : 0) })}</p>}
    {protection.decision && <p>{t(protection.decision.outcome === "waive" ? "protection.waived" : "protection.charged")}</p>}
    {balance.refund > 0 && <p>{t("protection.refunded", { amount: money(balance.refund) })}</p>}
    {(protection.deposit || protection.decision) && <p className="text-text-secondary">{t("protection.simulated")}</p>}
  </div>;
}
