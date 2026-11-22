import type { Locale } from "@/lib/locale";
import { writePostTask } from "../ai/tasks/write-post";
import type { Channel, DateKey } from "../data/types";
import { getActiveLocale, translate, translateCount } from "../i18n";
import { formatDate } from "../i18n/format";
import { assembleCopy } from "./channels";
import type { Goal } from "./goals";
import { applyVoice, NEUTRAL_VOICE, styleHints, type OwnerVoice } from "./voice";

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

/** The channel text without any AI: the task's rule-based draft in the owner's voice, plus the owner's sign-off, link and hashtags. */
export function rulesCopy(channel: Channel, offer: string, link: string, language: Locale = getActiveLocale(), voice: OwnerVoice = NEUTRAL_VOICE, signOff?: string): string {
  const { text, hashtags } = applyVoice(writePostTask.fallback({ offer, channel, locale: language }), voice);
  return assembleCopy(channel, text, hashtags, link, language, signOff);
}

/**
 * The request for the AI writer, or null when the text stays with the rules: a review is quoted word for word and
 * names a customer, so it never leaves the browser. Of the owner's voice only the style hints are sent; the
 * sign-off and hashtags are applied locally afterwards.
 */
export function postRequest(goal: Goal | undefined, offer: string, channel: Channel, locale: Locale, voice: OwnerVoice) {
  const style = styleHints(voice);
  return goal === "review" ? null : { offer, channel, locale, ...(style && { voice: style }) };
}
