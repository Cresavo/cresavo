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
      const key = /next visit|return|weeks?/.test(sentence.toLowerCase()) ? "nextVisit" : /recommend|advis/.test(sentence.toLowerCase()) ? "recommendation" : /observ|noticed|skin|nail/.test(sentence.toLowerCase()) ? "observations" : "treatment";
      result[key] = [result[key], sentence.trim()].filter(Boolean).join(" ");
    }
    return result;
  },
});
