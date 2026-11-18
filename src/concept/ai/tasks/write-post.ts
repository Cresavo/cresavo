import { z } from "zod";
import { defineTask, textField } from "../task";
const closing = {
  instagram: "Book your time online.",
  facebook: "Book online or contact the salon to find a suitable appointment.",
  tiktok: "Book your time online.",
  google: "Contact the salon to find a suitable appointment.",
  newsletter: "Pick a time that suits you and book online.",
  sms: "Book here:",
};

export const writePostTask = defineTask({
  id: "write-post", version: 1, tier: "fast",
  prompt: "Write a short English salon post for the given channel and offer. No invented claims. Return a draft only as JSON with text and hashtags.",
  input: z.object({ offer: textField, channel: z.enum(["instagram", "facebook", "tiktok", "google", "newsletter", "sms"]) }).strict(),
  output: z.object({ text: textField, hashtags: z.array(z.string()).max(10) }).strict(),
  fallback: ({ offer, channel }) => ({ text: `${offer}\n${closing[channel]}`, hashtags: channel === "instagram" || channel === "tiktok" ? ["#Salon", "#SelfCare"] : [] }),
});
