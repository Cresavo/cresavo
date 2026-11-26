import type { RegisterRecord } from "../../connections/ports/register";
import type { DemoState } from "../../data/types";
import { formatMinor } from "../../booking/policy-summary";
import { locale, t } from "../../i18n";
import { SALON_TIMEZONE } from "../../tools/clock";
import { AmountRow as Row } from "./amount-row";

/** A register receipt as the customer would get it. The demo register marks it with a watermark and its DEMO- number only. */
export function Receipt({ record, salon }: { record: RegisterRecord; salon: DemoState["salon"] }) {
  const money = (amount: number) => formatMinor(amount, record.currency);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: SALON_TIMEZONE }).format(new Date(record.at));
  const refund = record.kind === "refund";
  return (
    <article aria-label={t(refund ? "register.refundReceipt" : "register.receipt", { number: record.receiptNumber })}
      className="ui-print relative overflow-hidden rounded-lg bg-surface-2 px-4 py-5 text-meta">
      {record.register === "demo" && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
          <span className="-rotate-12 text-6xl font-semibold tracking-widest text-text opacity-10">{t("register.watermark")}</span>
        </span>
      )}
      <div className="relative space-y-4">
        <header className="space-y-1 text-center">
          <p className="text-body font-semibold">{salon.name}</p>
          {salon.address && <p className="text-text-secondary">{salon.address}</p>}
          {salon.orgNumber && <p className="text-text-secondary">{t("register.orgNumber", { number: salon.orgNumber })}</p>}
        </header>
        <div className="flex flex-col items-center gap-0.5 text-center tabular-nums sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:text-left">
          <span className="font-medium">{t(refund ? "register.refundReceipt" : "register.receipt", { number: record.receiptNumber })}</span>
          <span className="text-text-secondary">{when}</span>
        </div>
        {record.refundOf && <p>{t("register.refundOf", { number: record.refundOf })}</p>}
        <dl className="space-y-1 border-t border-hairline pt-3">
          {record.lines.map((line, i) => <Row key={i} label={line.description} value={money(line.grossMinor)} />)}
          <Row label={t(refund ? "register.refundTotal" : "register.total")} value={money(record.totalMinor)} strong className="text-body" />
        </dl>
        <dl className="space-y-1 border-t border-hairline pt-3">
          {record.prepaidMinor > 0 && <Row label={t("register.prepaid")} value={money(-record.prepaidMinor)} />}
          <Row label={t(`register.${record.method}`)} value={money(record.paidMinor)} />
          {record.tenderedMinor !== undefined && <Row label={t("register.received", { currency: record.currency })} value={money(record.tenderedMinor)} />}
          {record.changeMinor !== undefined && <Row label={t("register.change")} value={money(record.changeMinor)} />}
        </dl>
        <dl className="space-y-1 border-t border-hairline pt-3 text-text-secondary">
          {record.vat.map((line) => (
            <Row key={line.ratePercent} label={`${t("register.vat", { rate: line.ratePercent })} · ${t("register.net", { amount: money(line.netMinor) })}`} value={money(line.vatMinor)} />
          ))}
        </dl>
      </div>
    </article>
  );
}
