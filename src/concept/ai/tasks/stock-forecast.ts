import { z } from "zod";
import { ruleForecast } from "../../stock/forecast";
import { defineTask, textField } from "../task";
export const stockForecastTask = defineTask({
  id: "stock-forecast", version: 1, tier: "fast",
  prompt: "Estimate days remaining as floor(quantity/dailyUsage); null when usage is zero. Propose a reorder to cover leadTimeDays plus seven days. Never place orders. Return JSON.",
  input: z.object({ product: textField, quantity: z.number().nonnegative(), dailyUsage: z.number().nonnegative(), leadTimeDays: z.number().int().min(0).max(365) }).strict(),
  output: z.object({ product: textField, daysRemaining: z.number().int().nonnegative().nullable(), orderQuantity: z.number().int().nonnegative(), summary: textField }).strict(),
  fallback: ruleForecast,
});
