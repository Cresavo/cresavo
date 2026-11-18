import { z } from "zod";
import { defineTask, textField } from "../task";
export const replyCustomerTask = defineTask({
  id: "reply-customer", version: 1, tier: "fast",
  prompt: "Draft a polite English reply to the customer message using only the supplied facts. Never claim a booking is confirmed or a message sent. Return JSON text.",
  input: z.object({ customerName: textField, message: textField, facts: z.string().max(10000).default("") }).strict(),
  output: z.object({ text: textField }).strict(),
  fallback: ({ customerName, facts }) => ({ text: `Hello ${customerName}, thank you for your message. ${facts || "We will review your request and get back to you with a suggestion."}` }),
});
