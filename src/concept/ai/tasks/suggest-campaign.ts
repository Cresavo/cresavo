import { z } from "zod";
import { defineTask, textField } from "../task";
export const suggestCampaignTask = defineTask({
  id: "suggest-campaign", version: 1, tier: "smart",
  prompt: "Propose an English salon campaign using the given occasion and service. Discounts are proposals only, between 0 and 100 percent. Return JSON title, description and percentOff.",
  input: z.object({ occasion: textField, service: textField, priceSek: z.number().nonnegative() }).strict(),
  output: z.object({ title: textField, description: textField, percentOff: z.number().min(0).max(100), priceSek: z.number().nonnegative() }).strict(),
  fallback: ({ occasion, service, priceSek }) => ({ title: `${occasion}: ${service}`, description: `Propose a 10% offer on ${service} for ${occasion}.`, percentOff: 10, priceSek: Math.round(priceSek * 90) / 100 }),
});
