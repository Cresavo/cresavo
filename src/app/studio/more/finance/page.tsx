"use client";

import { useMemo } from "react";
import { addDays, diffDays } from "@/concept/data/dates";
import { t } from "@/concept/i18n";
import { formatMonth, formatMoney, formatNumber } from "@/concept/i18n/format";
import { findService, revenueByMonth, revenueSplit, utilisation } from "@/concept/selectors";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";
import { BarList, ColumnChart } from "@/concept/ui/charts";

const MONTHS = 6;
const SPLIT_DAYS = 90;

/** Short "SEK 48k" style used under chart columns. */
const compact = (amount: number) => t("money", { amount: amount >= 1000 ? `${formatNumber(amount / 1000)}k` : formatNumber(amount) });

export default function FinancePage() {
  const { state, today } = useStudio();
  const months = useMemo(() => revenueByMonth(state, today, MONTHS), [state, today]);
  const from = addDays(today, -SPLIT_DAYS);
  const byService = revenueSplit(state, today, from, "serviceId");
  const byStaff = revenueSplit(state, today, from, "staffId");
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInPrevious = diffDays(`${current.month}-01`, `${previous.month}-01`);
  const pace = previous.total ? (current.total / dayOfMonth) / (previous.total / daysInPrevious) - 1 : 0;
  const done = state.bookings.filter((b) => b.status === "completed" && b.date >= from);
  const average = done.length ? done.reduce((sum, b) => sum + b.price, 0) / done.length : 0;

  return (
    <MorePage title={t("nav.finance")} subtitle={t("finance.subtitle")} module="finance">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t("finance.thisMonth")} value={formatMoney(current.total)} note={t("finance.soFar", { day: dayOfMonth })} />
          <Kpi
            label={t("finance.pace")}
            value={`${pace >= 0 ? "+" : "−"}${t("format.percent", { value: formatNumber(Math.abs(pace) * 100) })}`}
            note={t("finance.paceNote", { month: formatMonth(previous.month) })}
          />
          <Kpi label={t("finance.average")} value={formatMoney(average)} note={t("finance.last90")} />
          <Kpi label={t("finance.booked")} value={t("format.percent", { value: formatNumber(utilisation(state, today, 7) * 100) })} note={t("finance.next7")} />
        </div>
        <Section title={t("finance.byMonth")}>
          <Card className="p-5">
            <ColumnChart
              label={t("finance.byMonth")}
              format={compact}
              data={months.map((m, i) => ({ label: formatMonth(m.month, true), value: m.total, highlight: i === months.length - 1 }))}
            />
            <p className="mt-3 text-xs text-eko-muted">{t("finance.currentNote")}</p>
          </Card>
        </Section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title={t("finance.byTreatment")}>
            <Card className="p-5">
              <BarList format={formatMoney} data={byService.map((r) => ({ id: r.id, label: findService(state, r.id)?.name ?? r.id, value: r.total }))} />
            </Card>
          </Section>
          <Section title={t("finance.byPerson")}>
            <Card className="p-5">
              <BarList
                format={formatMoney}
                data={byStaff.map((r) => ({
                  id: r.id,
                  label: state.staff.find((s) => s.id === r.id)?.firstName ?? r.id,
                  value: r.total,
                  tone: r.id === "anna" ? "bg-eko-anna" : "bg-eko-erik",
                }))}
              />
              <p className="mt-4 text-xs text-eko-muted">{t("finance.bookkeeping")}</p>
            </Card>
          </Section>
        </div>
      </div>
    </MorePage>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-eko-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-eko-muted">{note}</p>
    </Card>
  );
}
