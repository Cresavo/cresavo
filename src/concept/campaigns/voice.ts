import { isHashtag, isStockPhrase, type StyleHints } from "../ai/tasks/write-post";
import type { Campaign, DemoState } from "../data/types";

/** How the owner writes: the style hints plus the hashtags, which are only ever applied locally. */
export interface OwnerVoice extends StyleHints {
  hashtags: string[];
}

/** How many of the latest published campaigns tell how the owner writes. */
const RECENT = 5;
/** A habit needs at least this many campaigns; one text is a one-off. */
const RECURS = 2;
const MAX_HASHTAGS = 3;
/** Caption length bands, in characters of the Instagram text. */
const SHORT_UP_TO = 120;
const MEDIUM_UP_TO = 300;

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
/** A pictograph, a flag, or a keycap such as 1\uFE0F\u20E3. */
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
const graphemes = (text: string) => Array.from(SEGMENTER.segment(text), (part) => part.segment);
/** Whole emoji, so flags, skin tones and joined emoji are found and removed as one. */
const hasEmoji = (text: string) => graphemes(text).some((g) => EMOJI_GRAPHEME.test(g));
const stripEmoji = (text: string) => graphemes(text).filter((g) => !EMOJI_GRAPHEME.test(g)).join("");

/** No habits known: applying it changes nothing. */
export const NEUTRAL_VOICE: OwnerVoice = { hashtags: [], emoji: true };

/** Only campaigns that went out teach the voice; planned ones and drafts do not. */
const published = (state: Pick<DemoState, "campaigns">): Campaign[] =>
  state.campaigns.filter((c) => (c.status === "active" || c.status === "ended") && texts(c).length).slice(0, RECENT);

/** The texts of the channels the campaign was published on. */
const texts = (campaign: Campaign) => campaign.channels.flatMap((channel) => campaign.copy?.[channel] ?? []);

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
 * How this owner writes, from the texts of their latest published campaigns (nothing is stored): the hashtags
 * they keep coming back to, whether they use emoji, and how long their captions are. Hashtags the rule-based
 * writer adds itself do not count.
 */
export function ownerVoice(state: Pick<DemoState, "campaigns">): OwnerVoice {
  const campaigns = published(state);
  if (!campaigns.length) return NEUTRAL_VOICE;
  const hashtags = recurring(campaigns.map((c) => texts(c).flatMap((text) => text.match(HASHTAG) ?? []).filter((tag) => isHashtag(tag) && !isStockPhrase(tag)))).slice(0, MAX_HASHTAGS);
  const captions = campaigns.flatMap((c) => (c.channels.includes("instagram") && c.copy?.instagram) || []);
  const typical = captions.length ? median(captions.map((text) => text.length)) : undefined;
  return {
    hashtags,
    emoji: campaigns.some((c) => texts(c).some(hasEmoji)),
    ...(typical !== undefined && { length: typical <= SHORT_UP_TO ? "short" : typical <= MEDIUM_UP_TO ? "medium" : "long" }),
  };
}

/** The only part of the voice an AI provider gets: whether to use emoji and how long to write, when that was learned. */
export const styleHints = (voice: OwnerVoice): StyleHints | undefined =>
  voice.emoji && !voice.length ? undefined : { emoji: voice.emoji, ...(voice.length && { length: voice.length }) };

/**
 * The rule-based post in the owner's voice: emoji dropped when they never use any, their recurring hashtags
 * first.
 */
export function applyVoice(post: { text: string; hashtags: string[] }, voice: OwnerVoice): { text: string; hashtags: string[] } {
  const text = voice.emoji ? post.text : stripEmoji(post.text).replace(/[ \t]{2,}/g, " ");
  const seen = new Set<string>();
  const hashtags = [...voice.hashtags, ...post.hashtags].filter((tag) => !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
  return { text, hashtags };
}
