import { z } from "zod";
import { summarizeFallback } from "../../customers/summary";
import { defineTask, textField } from "../task";

export const summarizeCustomerTask = defineTask({
  id: "summarize-customer", version: 1, tier: "fast",
  prompt: "Write one short line (at most 20 words) that summarizes the customer for the owner, for example \"Regular since 2024, foot care every 6 weeks, sensitive skin, prefers Anna, afternoons.\" Use the requested language (English if unspecified). Use only the supplied facts; never invent visits, preferences or health information. Return JSON summary.",
  input: z.object({
    sinceYear: z.number().int().min(1900).max(2200), regular: z.boolean(), visits: z.number().int().nonnegative(),
    service: z.string().max(200).nullable(), intervalWeeks: z.number().int().positive().nullable(),
    traits: z.array(z.string().max(100)).max(20), prefersStaff: z.string().max(100).nullable(),
    timeOfDay: z.enum(["mornings", "afternoons", "evenings"]).nullable(), note: z.string().max(1000).nullable(),
    language: z.enum(["en", "sv"]).optional(),
  }).strict(),
  output: z.object({ summary: textField }).strict(),
  fallback: ({ language, ...facts }) => ({ summary: summarizeFallback(facts, language ?? "en") }),
});
