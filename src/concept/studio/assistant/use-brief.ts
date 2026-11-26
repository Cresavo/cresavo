"use client";

import { useEffect, useMemo, useState } from "react";
import { runAiTask } from "../../ai/api-client";
import { applyPhrasing, currentBrief, type Brief, type BriefKind } from "../../assistant/briefs";
import { taskEnabled } from "../../modules/registry";
import { useStudio } from "../use-studio";
import { useAiReady } from "./use-assistant";

const phrased = new Map<string, Brief>();

/**
 * The brief for this moment. Rules pick the items at once; an AI phrasing of the same items replaces them when a
 * model is configured and the brief is one of `phrase` (all kinds when left out).
 */
export function useBrief(phrase?: readonly BriefKind[]): { brief: Brief; ai: boolean } {
  const { state, today, minutes } = useStudio();
  const localOnly = !!state.industry;
  const aiReady = useAiReady(localOnly) && taskEnabled(state.modules, "phrase-brief");
  const brief = useMemo(() => currentBrief(state, { today, minutes }), [state, today, minutes]);
  const wanted = aiReady && (!phrase || phrase.includes(brief.kind));
  const key = JSON.stringify(brief);
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!wanted || !brief.items.length || phrased.has(key)) return;
    let current = true;
    const items = brief.items.map(({ id, text, priority }) => ({ id, text, priority }));
    runAiTask<{ headline: string; items: { id: string; text: string }[] }>("phrase-brief", { kind: brief.kind, items }, localOnly)
      .then(({ output, log }) => {
        if (!current || log.source !== "ai") return;
        phrased.set(key, applyPhrasing(brief, output));
        refresh((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [wanted, brief, key, localOnly]);

  const ai = localOnly || !wanted ? undefined : phrased.get(key);
  return { brief: ai ?? brief, ai: !!ai && ai !== brief };
}
