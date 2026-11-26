"use client";

import { useState } from "react";
import { summariseDay } from "../../connections/ports/register";
import { formatMinor } from "../../booking/policy-summary";
import { t, tc } from "../../i18n";
import { formatDayLong } from "../../i18n/format";
import { useRegisterReceipts } from "../../register/ledger";
import { Card, Section } from "../../ui/card";
import { Field, Select } from "../../ui/controls";
import { AmountRow } from "../register/amount-row";
import { useStudio } from "../use-studio";

/** The register's day per payment method and VAT rate, from its receipts. Shown once the register has taken a payment. */
export function DailyReport() {
  const { state, target } = useStudio();
  const receipts = useRegisterReceipts(target);
  const days = [...new Set(receipts.map((r) => r.date))].sort().reverse();
  const [picked, setPicked] = useState<string>();
  const day = picked && days.includes(picked) ? picked : days[0];
  if (!day) return null;
  const currency = receipts.find((r) => r.date === day)?.currency ?? state.localization.currency;
  const report = summariseDay(receipts, state.salon.slug, day, currency, "demo");
  const money = (amount: number) => formatMinor(amount, currency);
  const counts = [tc("register.report.receipts", report.receipts), report.refunds ? tc("register.report.refunds", report.refunds) : ""].filter(Boolean).join(" · ");
  return (
    <Section title={t("register.report.title")}>
      <Card className="space-y-5 p-4">
        {days.length > 1 ? (
          <Field label={t("register.report.day")} width="short">
            <Select value={day} onChange={(e) => setPicked(e.target.value)}>
              {days.map((d) => <option key={d} value={d}>{formatDayLong(d)}</option>)}
            </Select>
          </Field>
        ) : <p className="font-medium">{formatDayLong(day)}</p>}
        <div className="space-y-2">
          <h3 className="text-body font-semibold">{t("register.report.methods")}</h3>
          <dl className="divide-y divide-hairline">
            {report.methods.map(({ method, amountMinor }) => (
              <AmountRow key={method} label={t(method === "prepaid" ? "register.prepaidMethod" : `register.${method}`)} value={money(amountMinor)} className="py-2" />
            ))}
          </dl>
        </div>
        <div className="space-y-2">
          <h3 className="text-body font-semibold">{t("register.report.vat")}</h3>
          <dl className="divide-y divide-hairline">
            {report.vat.map((line) => (
              <AmountRow key={line.ratePercent} label={`${t("register.vat", { rate: line.ratePercent })} · ${t("register.net", { amount: money(line.netMinor) })}`} value={money(line.vatMinor)} className="py-2" />
            ))}
          </dl>
        </div>
        <div className="border-t border-hairline pt-3">
          <dl><AmountRow label={t("register.total")} value={money(report.totalMinor)} strong className="py-2" /></dl>
          <p className="text-meta text-text-secondary">{counts}</p>
        </div>
      </Card>
    </Section>
  );
}
