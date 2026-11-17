"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { fetchAiOverview, saveAiSettings } from "../../ai/api-client";
import type { AiOverview } from "../../ai/overview";
import type { TaskName } from "../../ai/registry";
import { t, tc } from "../../i18n";
import { formatUsd } from "../../i18n/format";
import { taskEnabled } from "../../modules/registry";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { useStudio } from "../use-studio";

/** Which AI task runs on which model, and what calls have cost since the server started. */
export function AiSection() {
  const { state } = useStudio();
  const [result, setResult] = useState<{ overview?: AiOverview; failed?: boolean }>({});

  const load = () => {
    fetchAiOverview().then(
      (overview) => setResult({ overview }),
      () => setResult({ failed: true }),
    );
  };
  useEffect(() => {
    load();
    window.addEventListener("concept-ai-settings", load);
    return () => window.removeEventListener("concept-ai-settings", load);
  }, []);

  const { overview, failed } = result;
  if (failed) {
    const retry = () => {
      setResult({});
      load();
    };
    return <EmptyState icon={<Sparkles size={22} />} title={t("ai.unavailable")} action={<Button size="sm" variant="secondary" onClick={retry}>{t("ai.retry")}</Button>} />;
  }
  if (!overview) return <Card className="h-40 animate-pulse bg-eko-sunken" aria-busy />;
  const { tasks, costLog, totals } = overview;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <p className="text-sm text-eko-muted">{overview.configured ? t("ai.modeAi") : t("ai.modeRules")}</p>
        <ul className="divide-y divide-eko-line">
          {tasks.filter((task) => taskEnabled(state.modules, task.name)).map((task) => (
            <li key={task.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t(`ai.task.${task.name}`)}</p>
                <p className="text-xs text-eko-muted">{t(`ai.task.${task.name}.description`)}</p>
              </div>
              <select className="rounded-lg border border-eko-line bg-eko-surface p-2 text-sm" aria-label={t("ai.taskTier", { task: t(`ai.task.${task.name}`) })} value={task.tier} onChange={async event => {
                try { setResult({ overview: await saveAiSettings({ task: task.name, tier: event.target.value as "fast" | "smart" }) }); }
                catch { setResult({ failed: true }); }
              }}>
                <option value="fast">{t("ai.tier.fast")}</option><option value="smart">{t("ai.tier.smart")}</option>
              </select>
              <div className="col-span-2">{task.provider ? <Badge tone="accent">{task.model}</Badge> : <Badge tone="neutral">{t("ai.rules")}</Badge>}</div>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("ai.costs")}</p>
            <p className="text-sm text-eko-muted">
              {tc("ai.totals", totals.calls, { ai: totals.aiCalls, cost: formatUsd(totals.costUsd) })}
              {totals.unknownCosts > 0 && ` ${tc("ai.unknownCosts", totals.unknownCosts)}`}
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={16} />} onClick={load}>{t("ai.refresh")}</Button>
        </div>
        {(["byTask", "byMonth"] as const).map(group => <div key={group}>
          <p className="text-sm font-medium">{t(group === "byTask" ? "ai.byTask" : "ai.byMonth")}</p>
          <ul className="divide-y divide-eko-line">{overview[group].map(row => <li className="flex justify-between gap-3 py-2 text-sm" key={row.name}>
            <span>{group === "byTask" ? t(`ai.task.${row.name as TaskName}`) : row.name} · {tc("ai.calls", row.calls)}</span>
            <span>{formatUsd(row.costUsd)}{row.unknownCosts > 0 && ` + ${tc("ai.unknownCosts", row.unknownCosts)}`}</span>
          </li>)}</ul>
        </div>)}
        {costLog.length ? (
          <ul className="divide-y divide-eko-line">
            {costLog.map((entry, index) => (
              <li key={entry.id ?? `${entry.timestamp}:${index}`} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t(`ai.task.${entry.task as TaskName}`)}</p>
                  <p className="truncate text-xs text-eko-muted">
                    {new Date(entry.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {entry.model}
                    {entry.source === "ai" && ` · ${entry.inputTokens + entry.outputTokens} tokens`}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">{entry.costUsd === 0 ? t("ai.free") : formatUsd(entry.costUsd)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-eko-sunken px-4 py-6 text-center text-sm text-eko-muted">{t("ai.noCalls")}</p>
        )}
        <p className="text-xs text-eko-muted">{t("ai.costNote")}</p>
      </Card>
    </div>
  );
}
