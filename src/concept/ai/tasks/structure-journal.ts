import { z } from "zod";
import { defineTask, textField } from "../task";
export const structureJournalTask = defineTask({
  id: "structure-journal", version: 1, tier: "smart",
  prompt: "Structure the supplied visit transcript into treatment, observations, recommendation and nextVisit. Preserve only stated facts; use empty strings for missing fields. Do not invent diagnoses or advice. Return JSON.",
  input: z.object({ transcript: textField }).strict(),
  output: z.object({ treatment: z.string(), observations: z.string(), recommendation: z.string(), nextVisit: z.string() }).strict(),
  fallback: ({ transcript }) => {
    const result = { treatment: "", observations: "", recommendation: "", nextVisit: "" };
    for (const sentence of transcript.split(/\n|(?<=[.!?])\s+/)) {
      const key = classify(sentence.toLowerCase());
      result[key] = [result[key], sentence.trim()].filter(Boolean).join(" ");
    }
    return result;
  },
});

/** Explicit cues win; body-part words like "skin" only break the tie after the treatment verbs. */
function classify(sentence: string): "treatment" | "observations" | "recommendation" | "nextVisit" {
  if (/next visit|return|weeks?/.test(sentence)) return "nextVisit";
  if (/recommend|advis/.test(sentence)) return "recommendation";
  if (/observ|noticed|\bsaw\b|\bfound\b/.test(sentence)) return "observations";
  if (/\b(treated|removed|trimmed|applied|performed|completed|filed|massaged|cleaned|softened|worked on|gave|did)\b/.test(sentence)) return "treatment";
  if (/skin|nail|dry|callus|tension|sore/.test(sentence)) return "observations";
  return "treatment";
}
