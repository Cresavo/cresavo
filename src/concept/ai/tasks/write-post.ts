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

/** How the owner writes, learned from published captions; every part is optional and length-limited. */
export const voiceSchema = z.object({
  signOff: z.string().trim().min(1).max(80).optional(),
  hashtags: z.array(z.string().trim().min(2).max(30)).max(3),
  emoji: z.boolean(),
  length: z.enum(["short", "medium", "long"]).optional(),
}).strict();
export type OwnerVoice = z.infer<typeof voiceSchema>;

const STOCK = ["campaigns.post.social", "campaigns.post.facebook", "campaigns.post.google", "campaigns.post.newsletter", "campaigns.post.sms", "campaigns.post.hashtagSalon", "campaigns.post.hashtagCare"] as const;

/** Whether a line or hashtag is one the rule-based writer adds itself, so it says nothing about the owner. */
export const isStockPhrase = (text: string) =>
  (["en", "sv"] as const).some((locale) => STOCK.some((key) => translate(locale, key).toLowerCase() === text.trim().toLowerCase()));

export const writePostTask = defineTask({
  id: "write-post", version: 2, tier: "fast",
  prompt: "Write a short salon post for the given channel and offer. Use English by default, or Swedish if locale is sv. No invented claims. If voice is given, write in the owner's style: end with the sign-off, prefer its hashtags, use emoji only if voice.emoji is true and match the length. Return a draft only as JSON with text and hashtags.",
  input: z.object({
    offer: textField,
    channel: z.enum(["instagram", "facebook", "tiktok", "google", "newsletter", "sms"]),
    locale: z.enum(["en", "sv"]).optional(),
    voice: voiceSchema.optional(),
  }).strict(),
  output: z.object({ text: textField, hashtags: z.array(z.string()).max(10) }).strict(),
  fallback: ({ offer, channel, locale = "en" }) => ({
    text: `${offer}\n${translate(locale, closing[channel])}`,
    hashtags: channel === "instagram" || channel === "tiktok"
      ? [translate(locale, "campaigns.post.hashtagSalon"), translate(locale, "campaigns.post.hashtagCare")]
      : [],
  }),
});
