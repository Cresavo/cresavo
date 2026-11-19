import { z } from "zod";
import { translate } from "../../i18n";
import { defineTask, textField } from "../task";

const closing = {
  instagram: "campaigns.post.social",
  facebook: "campaigns.post.facebook",
  tiktok: "campaigns.post.social",
  google: "campaigns.post.google",
  newsletter: "campaigns.post.newsletter",
  sms: "campaigns.post.sms",
} as const;

export const writePostTask = defineTask({
  id: "write-post", version: 2, tier: "fast",
  prompt: "Write a short salon post for the given channel and offer. Use English by default, or Swedish if locale is sv. No invented claims. Return a draft only as JSON with text and hashtags.",
  input: z.object({
    offer: textField,
    channel: z.enum(["instagram", "facebook", "tiktok", "google", "newsletter", "sms"]),
    locale: z.enum(["en", "sv"]).optional(),
  }).strict(),
  output: z.object({ text: textField, hashtags: z.array(z.string()).max(10) }).strict(),
  fallback: ({ offer, channel, locale = "en" }) => ({
    text: `${offer}\n${translate(locale, closing[channel])}`,
    hashtags: channel === "instagram" || channel === "tiktok"
      ? [translate(locale, "campaigns.post.hashtagSalon"), translate(locale, "campaigns.post.hashtagCare")]
      : [],
  }),
});
