import type { Locale } from "@/lib/locale";
import { writePostTask } from "../ai/tasks/write-post";
import type { Channel, DateKey } from "../data/types";
import { getActiveLocale, translate, translateCount } from "../i18n";
import { formatDate } from "../i18n/format";
import { assembleCopy } from "./channels";
import { applyVoice, NEUTRAL_VOICE, type OwnerVoice } from "./voice";

const NAMED_SERVICES = 2;

interface OfferInput {
  name: string;
  serviceNames: string[];
  discountPercent: number;
  to: DateKey;
}

/** "Deep tissue massage and Classic massage", or "Classic massage and 2 more". */
export function listServices(names: string[], language = getActiveLocale()): string {
  if (names.length <= NAMED_SERVICES) return names.join(translate(language, "campaigns.and"));
  return `${names[0]}${translate(language, "campaigns.and")}${translateCount(language, "campaigns.more", names.length - 1)}`;
}

/** One plain sentence for the writer: what is offered and until when. */
export function offerText({ name, serviceNames, discountPercent, to }: OfferInput, language = getActiveLocale()): string {
  const key = discountPercent > 0 ? "campaigns.offer.line" : "campaigns.offer.lineNoDiscount";
  return translate(language, key, { name, percent: discountPercent, services: listServices(serviceNames, language), date: formatDate(to, language) });
}

/** The channel text without any AI: the task's rule-based draft in the owner's voice, plus link and hashtags. */
export function rulesCopy(channel: Channel, offer: string, link: string, language: Locale = getActiveLocale(), voice: OwnerVoice = NEUTRAL_VOICE): string {
  const { text, hashtags, signOff } = applyVoice(writePostTask.fallback({ offer, channel, locale: language }), voice);
  return assembleCopy(channel, text, hashtags, link, language, signOff);
}
