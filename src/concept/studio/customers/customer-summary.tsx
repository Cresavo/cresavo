"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { buildCustomerFacts, summarizeFallback } from "../../customers/summary";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { useStudio } from "../use-studio";

const aiSummaries = new Map<string, string>();

/** One line about the customer. The rule text shows at once; an AI phrasing replaces it when a key is configured. */
export function CustomerSummary({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const facts = useMemo(() => buildCustomerFacts(state, customer), [state, customer]);
  const key = JSON.stringify(facts);
  const [, refresh] = useState(0);

  useEffect(() => {
    if (aiSummaries.has(key)) return;
    let current = true;
    isAiConfigured()
      .then((configured) => (configured ? runAiTask<{ summary: string }>("summarize-customer", facts) : null))
      .then((result) => {
        if (!current || !result || result.log.source !== "ai") return;
        aiSummaries.set(key, result.output.summary);
        refresh((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [key, facts]);

  const aiText = aiSummaries.get(key);
  return (
    <p className="flex items-start gap-2 rounded-xl bg-eko-sunken px-3.5 py-3 text-[15px] leading-relaxed">
      <Sparkles size={16} className="mt-1 shrink-0 text-eko-accent" aria-hidden />
      <span>
        {aiText ?? summarizeFallback(facts)}
        {aiText && <span className="ml-2 rounded-full bg-eko-accent-soft px-2 py-0.5 text-xs font-semibold text-eko-accent">{t("customer.summary.ai")}</span>}
      </span>
    </p>
  );
}
