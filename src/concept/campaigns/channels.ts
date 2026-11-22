import type { Locale } from "@/lib/locale";
import type { Channel } from "../data/types";
import { getActiveLocale, translate } from "../i18n";

export const CHANNELS: Channel[] = ["instagram", "facebook", "tiktok", "newsletter", "sms"];

/**
 * Longest text we let the owner send per channel. Instagram's own limit is
 * 2,200 characters; the others are kept short on purpose (an SMS is one
 * 160-character segment).
 */
export const CHANNEL_LIMIT: Record<Channel, number> = { instagram: 2200, facebook: 500, tiktok: 300, newsletter: 1000, sms: 160 };

const MAX_HASHTAGS = 5;
const HASHTAG_CHANNELS: Channel[] = ["instagram", "tiktok"];
const ELLIPSIS = "…";

/** The line that carries the trackable link; "Link in bio" where captions cannot hold clickable links. */
function linkLine(channel: Channel, link: string, language: Locale): string {
  return channel === "instagram" || channel === "tiktok" ? translate(language, "campaigns.copy.linkInBio", { link }) : link;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - ELLIPSIS.length));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}${ELLIPSIS}`;
}

/** The body without the sign-off it already ends with (an AI text may repeat it). */
const withoutSignOff = (body: string, signOff: string) => {
  const start = body.length - signOff.length;
  return body.endsWith(signOff) && (start === 0 || /\s/.test(body[start - 1])) ? body.slice(0, start).trimEnd() : body;
};

/**
 * Final text for a channel: the written body (shortened if needed), trackable link and, where they belong,
 * hashtags. The link is never cut off. The owner's sign-off goes before the link only when everything fits
 * without shortening the body; an SMS never gets one.
 */
export function assembleCopy(channel: Channel, body: string, hashtags: string[], link: string, language = getActiveLocale(), signOff?: string): string {
  const tags = HASHTAG_CHANNELS.includes(channel) ? hashtags.slice(0, MAX_HASHTAGS).join(" ") : "";
  const text = body.trim();
  const rest = [linkLine(channel, link, language), tags];
  if (signOff && channel !== "sms") {
    const full = `${withoutSignOff(text, signOff)}\n${[signOff, ...rest].filter(Boolean).join("\n")}`;
    if (full.length <= CHANNEL_LIMIT[channel]) return full;
  }
  const footer = rest.filter(Boolean).join("\n");
  const room = CHANNEL_LIMIT[channel] - footer.length - 1;
  return room > 0 ? `${truncate(text, room)}\n${footer}` : truncate(footer, CHANNEL_LIMIT[channel]);
}

export function isOverLimit(channel: Channel, text: string): boolean {
  return text.length > CHANNEL_LIMIT[channel];
}
