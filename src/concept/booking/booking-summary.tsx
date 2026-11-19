import { FlaskConical } from "lucide-react";
import { t } from "../i18n";
import { Badge } from "../ui/badge";
import type { Now } from "../use-now";
import { freeUntilText } from "./deadline-text";
import { hoursUntil, visitTime } from "./policy";
import { formatMinor } from "./policy-summary";
import type { BookingTerms } from "./protection";
import type { OpenSlot } from "./suggest";

export function BookingSummary({ slot, terms, now, phone, packagesEnabled }: {
  slot: OpenSlot; terms: BookingTerms; now: Now; phone: string; packagesEnabled: boolean;
}) {
  const { priceMinor, currency, depositMinor, freeHours, latePercent, noShowPercent } = terms;
  const instant = now.instant ?? visitTime({ date: now.today, start: now.minutes }).toMillis();
  const late = hoursUntil(slot, now.today, now.minutes, instant) < freeHours;
  const money = (amount: number) => formatMinor(amount, currency);
  return (
    <div className="booking-checkout-summary space-y-2 rounded-lg bg-surface-2 p-4 text-meta">
      <dl className="space-y-1">
        <div className="flex flex-wrap justify-between gap-x-3 font-semibold"><dt>{t("booking.summary.total")}</dt><dd>{money(priceMinor)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3"><dt>{t("booking.summary.dueNow")}</dt><dd>{money(depositMinor)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt>{t(packagesEnabled && !depositMinor ? "booking.summary.atSalonWithPackages" : "booking.summary.atSalon")}</dt><dd>{money(priceMinor - depositMinor)}</dd>
        </div>
      </dl>
      {depositMinor > 0 && <p>{t("booking.summary.depositRefund")}</p>}
      <Badge icon={FlaskConical}>{t(depositMinor ? "protection.simulated" : "booking.summary.simulated")}</Badge>
      <div className="space-y-1 border-t border-hairline pt-2">
        <p>{freeUntilText(slot, freeHours, instant)}</p>
        {late && <p>{phone ? t("booking.summary.deadlinePassedPhone", { phone }) : t("booking.summary.deadlinePassed")}</p>}
        <p>{latePercent || noShowPercent ? t("booking.summary.fees", { late: latePercent, missed: noShowPercent }) : t("booking.summary.noFees")}</p>
      </div>
    </div>
  );
}
