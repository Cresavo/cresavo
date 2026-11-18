import { z } from "zod";
import { defineTask, textField } from "../task";

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const whole = z.number().int().nonnegative();

export const dailySummaryTask = defineTask({
  id: "daily-summary", version: 2, tier: "fast",
  prompt: "Summarize the salon's day in English using only the supplied revenue, visits, no-shows, new customers, missing journals and tomorrow's first customer. Return JSON summary and highlights.",
  input: z.object({ revenueSek: z.number().nonnegative(), visits: whole, noShows: whole, newCustomers: whole, missingJournals: whole, tomorrowFirstCustomer: z.string().nullable() }).strict(),
  output: z.object({ summary: textField, highlights: z.array(z.string()) }).strict(),
  fallback: input => ({
    summary: `Today's revenue: ${input.revenueSek} SEK from ${count(input.visits, "visit")}.`,
    highlights: [
      count(input.noShows, "no-show"),
      count(input.newCustomers, "new customer"),
      count(input.missingJournals, "missing journal"),
      input.tomorrowFirstCustomer ? `Tomorrow starts with ${input.tomorrowFirstCustomer}.` : "No bookings tomorrow.",
    ],
  }),
});
