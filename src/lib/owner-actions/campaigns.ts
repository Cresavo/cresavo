import { z } from "zod";
import { TONE_RANGE } from "@/concept/campaigns/poster-engine/tone";
import { date, id, idList, list, money, percent, required, text } from "./primitives";

// Campaigns and their posters.

const MAX_URL = 2048;
const channel = z.enum(["instagram", "facebook", "tiktok", "newsletter", "sms"]);
const tone = (range: number) => z.number().min(-range).max(range);

const poster = z.strictObject({
  style: z.enum([
    "calm", "bold", "photo", "arch", "dusk", "price", "pricelist", "season", "review", "slots", "beforeafter", "portrait", "fullphoto", "typography",
  ]),
  image: text(MAX_URL),
  headline: text(500),
  detail: text(),
  textSize: z.enum(["small", "normal", "large"]).optional(),
  focus: z.enum(["top", "center", "bottom"]).optional(),
  arrangement: z.enum(["standard", "mirrored"]).optional(),
  price: text(40).optional(),
  sticker: z.tuple([text(40), text(40)]).optional(),
  items: list(z.strictObject({ name: text(120), price: text(40) }), 20).optional(),
  cta: text(120).optional(),
  quote: text().optional(),
  author: text(120).optional(),
  slotDate: date.optional(),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  badges: list(required(40), 12).optional(),
  before: text(MAX_URL).optional(),
  lead: text(200).optional(),
  backdrop: z.enum(["bloom", "leaves", "waves", "sun", "plain"]).optional(),
  socialQr: z.boolean().optional(),
  photoTone: z.strictObject({ light: tone(TONE_RANGE.light), contrast: tone(TONE_RANGE.contrast), warmth: tone(TONE_RANGE.warmth) }).optional(),
});

const copy = z.strictObject({
  instagram: text().optional(), facebook: text().optional(), tiktok: text().optional(), newsletter: text().optional(), sms: text().optional(),
});

const campaign = z.strictObject({
  name: required(),
  serviceIds: idList(50),
  discountPercent: percent,
  from: date,
  to: date,
  channels: list(channel, 5),
  holidayId: id.optional(),
  publishOn: date.optional(),
  copy: copy.optional(),
  signOff: text(500).optional(),
  poster: poster.optional(),
  link: text(MAX_URL).optional(),
});

export const campaignSchemas = {
  "campaign/launch": z.strictObject({ type: z.literal("campaign/launch"), campaign, today: date }),
  "campaign/ad": z.strictObject({
    type: z.literal("campaign/ad"), id, ad: z.strictObject({ budget: money, days: z.number().int().min(0).max(365), radiusKm: z.number().min(0).max(1000) }),
  }),
};
