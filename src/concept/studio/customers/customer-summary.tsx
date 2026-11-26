"use client";

import { useEffect, useMemo, useState } from "react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { buildCustomerFacts, summarizeFallback } from "../../customers/summary";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { useLocale } from "@/app/components/locale-provider";
import { useStudio } from "../use-studio";

const aiSummaries = new Map<string, string>();

/** One line about the customer. The rule text shows at once; an AI phrasing replaces it when a key is configured. */
export function CustomerSummary({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const language = useLocale();
  const localOnly = !!state.industry;
  const facts = useMemo(() => buildCustomerFacts(state, customer), [state, customer]);
  const key = JSON.stringify({ ...facts, language });
  const [, refresh] = useState(0);

  useEffect(() => {
    if (aiSummaries.has(key)) return;
    let current = true;
    isAiConfigured(localOnly)
      .then((configured) => (configured ? runAiTask<{ summary: string }>("summarize-customer", { ...facts, language }, localOnly) : null))
      .then((result) => {
        if (!current || !result || result.log.source !== "ai") return;
        aiSummaries.set(key, result.output.summary);
        refresh((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [key, facts, language, localOnly]);

  const aiText = localOnly ? undefined : aiSummaries.get(key);
  return (
    <p className="flex items-start gap-2 text-body leading-relaxed">
      <span>
        {aiText ?? summarizeFallback(facts, language)}
        {aiText && <span className="ml-2 rounded-full bg-action-bg px-2 py-1 text-xs font-semibold text-text">{t("customer.summary.ai")}</span>}
      </span>
    </p>
  );
}
