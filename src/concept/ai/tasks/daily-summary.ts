import { z } from "zod";
import { defineTask, textField } from "../task";
export const dailySummaryTask = defineTask({
  id: "daily-summary", version: 1, tier: "fast",
  prompt: "Summarize the salon's day in English using only the supplied revenue, new customers, missing journals and tomorrow's first customer. Return JSON summary and highlights.",
  input: z.object({ revenueSek: z.number().nonnegative(), newCustomers: z.number().int().nonnegative(), missingJournals: z.number().int().nonnegative(), tomorrowFirstCustomer: z.string().nullable() }).strict(),
  output: z.object({ summary: textField, highlights: z.array(z.string()) }).strict(),
  fallback: input => ({ summary: `Today's revenue: ${input.revenueSek} SEK.`, highlights: [`${input.newCustomers} new customers`, `${input.missingJournals} missing journals`, input.tomorrowFirstCustomer ? `Tomorrow starts with ${input.tomorrowFirstCustomer}.` : "No bookings tomorrow."] }),
});
