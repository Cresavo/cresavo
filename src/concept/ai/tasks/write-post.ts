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

/** A hashtag: "#" and 1-29 letters, digits or underscores, 30 characters at most. */
export const isHashtag = (text: string) => /^#[\p{L}\p{N}_]{1,29}$/u.test(text);

/** Style hints for the AI, learned from published captions. Never a name, a quote or a line the owner wrote. */
export const voiceSchema = z.object({
  emoji: z.boolean(),
  length: z.enum(["short", "medium", "long"]).optional(),
}).strict();
export type StyleHints = z.infer<typeof voiceSchema>;

const STOCK = ["campaigns.post.social", "campaigns.post.facebook", "campaigns.post.google", "campaigns.post.newsletter", "campaigns.post.sms", "campaigns.post.hashtagSalon", "campaigns.post.hashtagCare"] as const;

/** Whether a line or hashtag is one the rule-based writer adds itself, so it says nothing about the owner. */
export const isStockPhrase = (text: string) =>
  (["en", "sv"] as const).some((locale) => STOCK.some((key) => translate(locale, key).toLowerCase() === text.trim().toLowerCase()));

export const writePostTask = defineTask({
  id: "write-post", version: 2, tier: "fast",
  prompt: "Write a short salon post for the given channel and offer. Use English by default, or Swedish if locale is sv. No invented claims. If voice is given, write in that style: use emoji only if voice.emoji is true and match voice.length. Do not add a sign-off; the owner's own sign-off and hashtags are added afterwards. Return a draft only as JSON with text and hashtags.",
  input: z.object({
    offer: textField,
    channel: z.enum(["instagram", "facebook", "tiktok", "google", "newsletter", "sms"]),
    locale: z.enum(["en", "sv"]).optional(),
    voice: voiceSchema.optional(),
  }).strict(),
  output: z.object({ text: textField, hashtags: z.array(z.string().refine(isHashtag)).max(10) }).strict(),
  fallback: ({ offer, channel, locale = "en" }) => ({
    text: `${offer}\n${translate(locale, closing[channel])}`,
    hashtags: channel === "instagram" || channel === "tiktok"
      ? [translate(locale, "campaigns.post.hashtagSalon"), translate(locale, "campaigns.post.hashtagCare")]
      : [],
  }),
});
