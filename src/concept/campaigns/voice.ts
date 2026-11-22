import { isStockPhrase, type OwnerVoice } from "../ai/tasks/write-post";
import type { Campaign, DemoState } from "../data/types";

export type { OwnerVoice };

/** How many of the latest published campaigns tell how the owner writes. */
const RECENT = 5;
/** A habit needs at least this many campaigns; one text is a one-off. */
const RECURS = 2;
const MAX_HASHTAGS = 3;
const MAX_SIGN_OFF = 80;
/** Caption length bands, in characters of the Instagram text. */
const SHORT_UP_TO = 120;
const MEDIUM_UP_TO = 300;

const LINK = /https?:\/\/|\S\.[a-z]{2,}\/\S/i;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const EMOJI = /\p{Extended_Pictographic}\uFE0F?/gu;
const HAS_EMOJI = /\p{Extended_Pictographic}/u;

/** No habits known: applying it changes nothing. */
export const NEUTRAL_VOICE: OwnerVoice = { hashtags: [], emoji: true };

const published = (state: Pick<DemoState, "campaigns">): Campaign[] =>
  state.campaigns.filter((c) => c.status !== "draft" && c.copy && Object.keys(c.copy).length).slice(0, RECENT);

const texts = (campaign: Campaign) => Object.values(campaign.copy ?? {});

/** The last line of a text that is the owner's own words: not the link, hashtags or a line the writer adds itself. */
function closingLine(text: string): string | undefined {
  return text.split("\n").map((line) => line.trim()).filter((line) => line && !LINK.test(line) && line.replace(HASHTAG, "").trim() && !isStockPhrase(line)).at(-1);
}

/** The values that show up in at least two campaigns, most common first. Each campaign counts a value once. */
function recurring(perCampaign: string[][]): string[] {
  const counts = new Map<string, { shown: string; count: number }>();
  for (const values of perCampaign) {
    for (const [key, shown] of new Map(values.map((value) => [value.toLowerCase(), value]))) {
      const seen = counts.get(key);
      counts.set(key, { shown: seen?.shown ?? shown, count: (seen?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()].filter((v) => v.count >= RECURS).sort((a, b) => b.count - a.count).map((v) => v.shown);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * How this owner writes, from the texts of their latest published campaigns (nothing is stored): the sign-off
 * line and the hashtags they keep coming back to, whether they use emoji, and how long their captions are.
 * Lines and hashtags the rule-based writer adds itself do not count.
 */
export function ownerVoice(state: Pick<DemoState, "campaigns">): OwnerVoice {
  const campaigns = published(state);
  if (!campaigns.length) return NEUTRAL_VOICE;
  const signOff = recurring(campaigns.map((c) => texts(c).map(closingLine).filter((line): line is string => !!line && line.length <= MAX_SIGN_OFF)))[0];
  const hashtags = recurring(campaigns.map((c) => texts(c).flatMap((text) => text.match(HASHTAG) ?? []).filter((tag) => !isStockPhrase(tag)))).slice(0, MAX_HASHTAGS);
  const captions = campaigns.flatMap((c) => c.copy?.instagram ?? []);
  const typical = captions.length ? median(captions.map((text) => text.length)) : undefined;
  return {
    ...(signOff && { signOff }),
    hashtags,
    emoji: campaigns.some((c) => texts(c).some((text) => HAS_EMOJI.test(text))),
    ...(typical !== undefined && { length: typical <= SHORT_UP_TO ? "short" : typical <= MEDIUM_UP_TO ? "medium" : "long" }),
  };
}

/** Whether there is anything to write differently. */
export const hasVoice = (voice: OwnerVoice) => !!voice.signOff || voice.hashtags.length > 0 || !voice.emoji;

/**
 * The rule-based post in the owner's voice: emoji dropped when they never use any, their recurring hashtags
 * first, and their sign-off returned apart so that it is kept when the text is cut to the channel's limit.
 */
export function applyVoice(post: { text: string; hashtags: string[] }, voice: OwnerVoice): { text: string; hashtags: string[]; signOff?: string } {
  const text = voice.emoji ? post.text : post.text.replace(EMOJI, "").replace(/[ \t]{2,}/g, " ");
  const seen = new Set<string>();
  const hashtags = [...voice.hashtags, ...post.hashtags].filter((tag) => !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
  return { text, hashtags, ...(voice.signOff && !text.includes(voice.signOff) && { signOff: voice.signOff }) };
}
