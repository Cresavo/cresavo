"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sparkles } from "lucide-react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { dailySummaryTask } from "../../ai/tasks/daily-summary";
import { t } from "../../i18n";
import { taskEnabled } from "../../modules/registry";
import { dayFacts, summaryDue } from "../../summary/day";
import { Card, Section } from "../../ui/card";
import { useStudio } from "../use-studio";

interface Summary {
  summary: string;
  highlights: string[];
}

const aiSummaries = new Map<string, Summary>();

/** After the last booking: the day in a few lines. The rule text shows at once; an AI phrasing replaces it when a key is configured. */
export function EveningSummary() {
  const { state, today, minutes } = useStudio();
  const due = taskEnabled(state.modules, "daily-summary") && summaryDue(state, { today, minutes });
  const facts = useMemo(() => dayFacts(state, { today, minutes }), [state, today, minutes]);
  const key = JSON.stringify(facts);
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!due || aiSummaries.has(key)) return;
    let current = true;
    isAiConfigured()
      .then((configured) => (configured ? runAiTask<Summary>("daily-summary", facts) : null))
      .then((result) => {
        if (!current || !result || result.log.source !== "ai") return;
        aiSummaries.set(key, result.output);
        refresh((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [due, key, facts]);

  if (!due) return null;
  const ai = aiSummaries.get(key);
  const text = ai ?? dailySummaryTask.fallback(facts);
  return (
    <Section title={t("summary.title")}>
      <Card className="space-y-3 p-4" data-help="evening-summary">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-action-bg text-action"><Moon size={18} /></span>
          <p className="min-w-0 flex-1 pt-1.5 font-medium">{text.summary}</p>
          {ai && <Sparkles size={16} className="mt-1 shrink-0 text-action" aria-label={t("customer.summary.ai")} />}
        </div>
        <ul className="space-y-1 text-sm">
          {text.highlights.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-action" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
