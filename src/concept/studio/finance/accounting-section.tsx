"use client";

import { useEffect, useState } from "react";
import { BookCheck, Download, Loader2, Unplug } from "lucide-react";
import { addDays } from "../../data/dates";
import { EXPORT_MONTHS, salesCsv, salesPerDay, sieFile } from "../../finance/accounting";
import { totalCosts } from "../../finance/profit";
import { t } from "../../i18n";
import { formatDayShort, formatMoney } from "../../i18n/format";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { download } from "../more/export";
import { useStudio } from "../use-studio";

const PREVIEW_DAYS = 14;
const PREVIEW_ROWS = 5;
const CONNECT_DELAY_MS = 1400;

/** Simulated bookkeeping connection with a preview of what would sync, and plain file exports. */
export function AccountingSection() {
  const { state, today, minutes } = useStudio();
  const clock = { today, minutes };
  const [connecting, setConnecting] = useState(false);
  const connected = state.accounting.connected;

  useEffect(() => {
    if (!connecting) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "accounting/connect", on: today });
      setConnecting(false);
      showToast(t("finance.connectedToast"));
    }, CONNECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [connecting, today]);

  const days = salesPerDay(state, { start: addDays(today, -PREVIEW_DAYS), end: addDays(today, 1) }, clock).slice(-PREVIEW_ROWS);
  const fees = state.costs.filter((c) => c.kind === "fees");

  return (
    <Section title={t("finance.bookkeeping")}>
      <Card className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-action-bg text-action">
            <BookCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{t("finance.accounted")}</p>
              <Badge tone={connected ? "accent" : "neutral"}>{connected ? t("finance.connected") : t("finance.notConnected")}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{connected ? t("finance.connectedText") : t("finance.accountedText")}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{connected ? t("finance.syncs") : t("finance.wouldSync")}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary">
                <th className="py-1 font-medium">{t("finance.day")}</th>
                <th className="py-1 text-right font-medium">{t("finance.sales")}</th>
                <th className="py-1 text-right font-medium">{t("finance.vat")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {days.map((day) => (
                <tr key={day.date}>
                  <td className="py-1.5">{formatDayShort(day.date)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(day.net)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(day.vat)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5">{t("finance.feesRow")}</td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(totalCosts(fees))}</td>
                <td className="py-1.5 text-right text-text-secondary">{t("finance.perMonth")}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-text-secondary">{t("finance.syncNote")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button variant="secondary" icon={<Unplug size={16} />} onClick={() => dispatch({ type: "accounting/disconnect" })}>
              {t("finance.disconnect")}
            </Button>
          ) : (
            <Button icon={connecting ? <Loader2 size={16} className="animate-spin" /> : undefined} disabled={connecting} onClick={() => setConnecting(true)}>
              {connecting ? t("finance.connecting") : t("finance.connect")}
            </Button>
          )}
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => download("flerdo-bookkeeping.sie", sieFile(state, clock), "text/plain")}>
            {t("finance.downloadSie")}
          </Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => download("flerdo-sales.csv", salesCsv(state, clock), "text/csv")}>
            {t("finance.downloadCsv")}
          </Button>
        </div>
        <p className="text-xs text-text-secondary">{t("finance.exportNote", { months: EXPORT_MONTHS })}</p>
      </Card>
    </Section>
  );
}
