import type { Vocabulary } from "../packs/types";
import { en } from "./en";

// All user-facing studio text goes through `t()`. To add a language, create a
// dictionary with the same shape as `en.ts` and select it here.

const dictionary = en;

export type MessageKey = keyof typeof dictionary.messages;
type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;

// The dictionary is written with "customer" and "treatment". An industry pack
// swaps those two words (and their plurals) for its own, e.g. "client" and
// "session", before a message is filled in.
const DEFAULT_VOCABULARY: Vocabulary = { customer: "customer", service: "treatment" };
let vocabulary = DEFAULT_VOCABULARY;

export function setVocabulary(next: Vocabulary) {
  vocabulary = next;
}

/** The active word for a customer or a service, e.g. `term("customer", { plural: true })` is "clients". */
export function term(word: keyof Vocabulary, options: { plural?: boolean; capital?: boolean } = {}): string {
  const text = vocabulary[word] + (options.plural ? "s" : "");
  return options.capital ? text[0].toUpperCase() + text.slice(1) : text;
}

const WORDS: Record<string, keyof Vocabulary> = { customer: "customer", treatment: "service", service: "service" };

/** Swaps the canonical words in the text outside {placeholders}; keeps capital letters and plurals. */
function localize(text: string): string {
  if (vocabulary === DEFAULT_VOCABULARY) return text;
  return text
    .split(/(\{\w+\})/)
    .map((part) =>
      part.startsWith("{")
        ? part
        : part.replace(/\b(customer|treatment|service)(s?)\b/gi, (match, word: string, plural: string) =>
            term(WORDS[word.toLowerCase()], { plural: plural === "s", capital: match[0] !== match[0].toLowerCase() }),
          ),
    )
    .join("");
}

export function t(key: MessageKey, vars?: Vars): string {
  return fill(localize(dictionary.messages[key]), vars);
}

/** Messages written as "one|many" pick a form by `count`, which is also available as {count}. */
export function tc(key: MessageKey, count: number, vars?: Vars): string {
  const [one, many = one] = localize(dictionary.messages[key]).split("|");
  return fill(count === 1 ? one : many, { count, ...vars });
}

export const words = dictionary.words;
export const locale = dictionary.locale;
