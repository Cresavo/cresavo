import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../../i18n";
import { HELP_MAP } from "./entries";
import type { HelpEntry } from "./types";

// Free text to a help-map entry, on the device: no model and no network. Both languages are searched whatever the
// studio language is, so "boka om" and "reschedule" find the same place. Accents are ignored, a typo of one letter
// is forgiven, and words such as "hur", "jag", "how" and "do" are left out.

const STOP = new Set([
  // English
  "a", "an", "the", "i", "me", "my", "we", "our", "you", "your", "it", "is", "are", "am", "be", "do", "does", "did", "can",
  "could", "would", "should", "will", "how", "what", "where", "when", "why", "which", "who", "to", "of", "in", "on", "at",
  "for", "from", "with", "and", "or", "this", "that", "there", "here", "please", "want", "need", "like", "find", "show",
  "tell", "help", "get", "make", "go", "way", "some", "any", "one",
  // Swedish, without accents (they are removed before this check)
  "hur", "var", "vad", "nar", "vem", "vilken", "vilket", "varfor", "jag", "mig", "min", "mitt", "mina", "du", "dig", "din",
  "ditt", "vi", "oss", "det", "den", "de", "en", "ett", "och", "eller", "att", "som", "pa", "i", "av", "for", "till", "med",
  "fran", "om", "kan", "ska", "skall", "vill", "maste", "gor", "gora", "far", "finns", "hittar", "hitta", "visa", "man",
  "ar", "har", "nagon", "nagot", "sa", "da", "dar", "lite", "snalla", "tack",
]);

/** The weight of a word in an entry's name or search words; a caption word weighs 1. */
const NAME_WEIGHT = 3;
const MIN_SCORE = 2;
const AMBIGUOUS = 0.8;
const ALTERNATIVE = 0.5;
const PHRASE_BONUS = 2;

/** Swedish particle verbs whose particle is also a stop word: "boka om" is not "boka". */
const PARTICLES: [RegExp, string][] = [[/\b(boka|flytta|andra|gora) om\b/g, "om$1"]];

/** Lower case, accents removed, split into words, stop words dropped. */
export function helpWords(text: string): string[] {
  let plain = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  for (const [pattern, joined] of PARTICLES) plain = plain.replace(pattern, joined);
  return plain
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

function distanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    previous = row;
  }
  return previous[b.length] <= max;
}

/** How well one asked word matches one indexed word: exact, a shared stem ("flyttar" and "flytta"), or a typo. */
export function wordMatch(asked: string, known: string): number {
  if (asked === known) return 1;
  const [short, long] = asked.length <= known.length ? [asked, known] : [known, asked];
  if (short.length >= 4 && long.startsWith(short)) return 0.8;
  if (short.length >= 5 && distanceAtMost(asked, known, long.length >= 8 ? 2 : 1)) return 0.6;
  return 0;
}

interface Indexed {
  entry: HelpEntry;
  /** Word to field weight: the name and search words count three times as much as the caption. */
  words: Map<string, number>;
  phrases: string[][];
}

const LANGUAGES: Locale[] = ["en", "sv"];
let index: { items: Indexed[]; rarity: Map<string, number> } | null = null;

function text(language: Locale, key: string): string {
  return translate(language, key as MessageKey);
}

function build() {
  const items = HELP_MAP.map((entry): Indexed => {
    const words = new Map<string, number>();
    const add = (value: string, weight: number) => {
      for (const word of helpWords(value)) words.set(word, Math.max(words.get(word) ?? 0, weight));
    };
    const phrases: string[][] = [];
    for (const language of LANGUAGES) {
      add(translate(language, entry.label), NAME_WEIGHT);
      const keywords = text(language, `showMe.${entry.id}.keywords`).split(",");
      for (const keyword of keywords) {
        add(keyword, NAME_WEIGHT);
        const words = helpWords(keyword);
        if (words.length > 1) phrases.push(words);
      }
      add(text(language, `showMe.${entry.id}.hint`), 1);
    }
    return { entry, words, phrases };
  });
  // A word found in many places ("booking") says less than a rare one ("opening").
  const counts = new Map<string, number>();
  for (const item of items) for (const word of item.words.keys()) counts.set(word, (counts.get(word) ?? 0) + 1);
  const rarity = new Map([...counts].map(([word, count]) => [word, 1 + Math.log(items.length / count)]));
  return { items, rarity };
}

/** How well a question fits an entry. Zero unless a word hits the entry's name or search words: a caption alone is not enough. */
function score(asked: string[], item: Indexed, rarity: Map<string, number>): number {
  let total = 0;
  let named = false;
  const matched = new Set<string>();
  for (const word of asked) {
    let best = 0;
    for (const [known, weight] of item.words) {
      const match = wordMatch(word, known);
      if (!match) continue;
      best = Math.max(best, match * weight * (rarity.get(known) ?? 1));
      if (match >= 0.8) matched.add(known);
      if (weight >= NAME_WEIGHT) named = true;
    }
    total += best;
  }
  if (!named) return 0;
  for (const phrase of item.phrases) if (phrase.every((word) => matched.has(word))) total += PHRASE_BONUS * phrase.length;
  return total;
}

export interface HelpMatch {
  best: HelpEntry | null;
  /** Other good places, best first: plain choices when the question could mean more than one thing. */
  alternatives: HelpEntry[];
  /** The best match is not clearly better than the next one. */
  ambiguous: boolean;
}

/** The best help-map entry for a question in Swedish or English, and a few alternatives. */
export function findHelp(question: string): HelpMatch {
  index ??= build();
  const asked = [...new Set(helpWords(question))];
  if (!asked.length) return { best: null, alternatives: [], ambiguous: false };
  const ranked = index.items
    .map((item) => ({ entry: item.entry, score: score(asked, item, index!.rarity) }))
    .filter((result) => result.score >= MIN_SCORE)
    // Of two equal matches, the one closer to the start is the simpler answer.
    .sort((a, b) => b.score - a.score || a.entry.path.length - b.entry.path.length);
  // A step on the way is not an answer when the place it leads to matches about as well.
  const kept = ranked.filter((result) =>
    !ranked.some((other) => other !== result && other.entry.path.includes(result.entry.id) && other.score >= result.score * 0.9));
  if (!kept.length) return { best: null, alternatives: [], ambiguous: false };
  const [first, ...rest] = kept;
  const alternatives = rest.filter((result) => result.score >= first.score * ALTERNATIVE).slice(0, 3);
  return {
    best: first.entry,
    alternatives: alternatives.map((result) => result.entry),
    ambiguous: !!alternatives[0] && alternatives[0].score >= first.score * AMBIGUOUS,
  };
}
