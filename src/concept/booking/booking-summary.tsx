import { t } from "../i18n";
import { formatMoney } from "../i18n/format";
import { freeUntilText } from "./deadline-text";
import type { OpenSlot } from "./suggest";

export function BookingSummary({ slot, price, currency, late, phone }: {
  slot: OpenSlot; price: number; currency: string; late: boolean; phone: string;
}) {
  const total = formatMoney(price, currency);
  return (
    <div className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
      <dl className="space-y-1">
        <div className="flex flex-wrap justify-between gap-x-3 font-semibold"><dt>{t("booking.summary.total")}</dt><dd>{total}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3"><dt>{t("booking.summary.dueNow")}</dt><dd>{formatMoney(0, currency)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3"><dt>{t("booking.summary.atSalon")}</dt><dd>{total}</dd></div>
      </dl>
      <p className="text-text-secondary">{t("booking.summary.simulated")}</p>
      <div className="space-y-1 border-t border-hairline pt-2">
        <p>{freeUntilText(slot)}</p>
        {late && <p className="text-text-secondary">{phone ? t("booking.summary.deadlinePassedPhone", { phone }) : t("booking.summary.deadlinePassed")}</p>}
      </div>
    </div>
  );
}
