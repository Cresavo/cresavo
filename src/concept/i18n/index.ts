import { intlLocale, type Locale } from "@/lib/locale";
import type { Vocabulary } from "../packs/types";
import { en } from "./en";
import { sv } from "./sv";

const dictionaries = { en, sv };

export type MessageKey = keyof typeof en.messages;
type Vars = Record<string, string | number>;
type Word = "customer" | "service";

const DEFAULT_VOCABULARY: Vocabulary = { customer: "customer", service: "treatment" };
let vocabulary = DEFAULT_VOCABULARY;
let language: Locale = "en";
export let words = en.words;
export let locale = intlLocale(language);

export function setLocale(next: Locale) {
  language = next;
  locale = intlLocale(next);
  words = dictionaries[next].words;
}

export function getActiveLocale(): Locale {
  return language;
}

export function setVocabulary(next: Vocabulary) {
  vocabulary = next;
}

export function getVocabulary(): Vocabulary {
  return vocabulary;
}

const SWEDISH = {
  customer: ["kund", "kunder", "kunden", "kunderna", "kunds", "kunders", "kundens", "kundernas"],
  service: ["behandling", "behandlingar", "behandlingen", "behandlingarna", "behandlings", "behandlingars", "behandlingens", "behandlingarnas"],
};

function swedishForms(word: string, plural: string, definite: string, definitePlural: string) {
  return [word, plural, definite, definitePlural, `${word}s`, `${plural}s`, `${definite}s`, `${definitePlural}s`];
}

const SWEDISH_FORMS: Record<string, string[]> = {
  klient: swedishForms("klient", "klienter", "klienten", "klienterna"),
  patient: swedishForms("patient", "patienter", "patienten", "patienterna"),
  session: swedishForms("session", "sessioner", "sessionen", "sessionerna"),
  tjänst: swedishForms("tjänst", "tjänster", "tjänsten", "tjänsterna"),
};

function forms(word: Word, lang: Locale, terms: Vocabulary): string[] {
  return lang === "sv" ? SWEDISH_FORMS[terms.sv?.[word] ?? ""] ?? SWEDISH[word] : [terms[word], `${terms[word]}s`];
}

function matchCase(text: string, original: string) {
  return original[0] === original[0].toLowerCase() ? text : text[0].toUpperCase() + text.slice(1);
}

export function term(word: Word, options: { plural?: boolean; capital?: boolean; vocabulary?: Vocabulary } = {}): string {
  const text = forms(word, language, options.vocabulary ?? vocabulary)[options.plural ? 1 : 0];
  return options.capital ? matchCase(text, "A") : text;
}

const ENGLISH = { customer: "customer", treatment: "service", service: "service" } as const;
const SWEDISH_WORD = /(?<![\p{L}\p{N}])(?:kund(?:er(?:na)?|en)?s?|behandling(?:ar(?:na)?|en)?s?)(?![\p{L}\p{N}])/giu;

function localize(text: string, lang: Locale, terms: Vocabulary): string {
  if (terms === DEFAULT_VOCABULARY) return text;
  return text.split(/(\{\w+\})/).map((part) => {
    if (part.startsWith("{")) return part;
    if (lang === "sv") {
      return part.replace(SWEDISH_WORD, (match) => {
        const lower = match.toLowerCase();
        const word = lower.startsWith("kund") ? "customer" : "service";
        return matchCase(forms(word, lang, terms)[SWEDISH[word].indexOf(lower)], match);
      });
    }
    return part.replace(/\b(customer|treatment|service)(s?)\b/gi, (match, word: string, plural: string) =>
      matchCase(forms(ENGLISH[word.toLowerCase() as keyof typeof ENGLISH], lang, terms)[plural ? 1 : 0], match),
    );
  }).join("");
}

function fill(text: string, vars: Vars | undefined, lang: Locale) {
  return vars ? text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars[name];
    return typeof value === "number" ? new Intl.NumberFormat(intlLocale(lang)).format(value) : value ?? placeholder;
  }) : text;
}

/** Translate for a specific audience without changing the current view or request. */
export function translate(lang: Locale, key: MessageKey, vars?: Vars, terms = DEFAULT_VOCABULARY): string {
  return fill(localize(dictionaries[lang].messages[key], lang, terms), vars, lang);
}

export function t(key: MessageKey, vars?: Vars): string {
  return translate(language, key, vars, vocabulary);
}

/** Messages written as "one|many" pick a form by count, which is also available as {count}. */
export function translateCount(lang: Locale, key: MessageKey, count: number, vars?: Vars, terms = DEFAULT_VOCABULARY): string {
  const [one, many = one] = localize(dictionaries[lang].messages[key], lang, terms).split("|");
  return fill(new Intl.PluralRules(intlLocale(lang)).select(count) === "one" ? one : many, { count, ...vars }, lang);
}

export function tc(key: MessageKey, count: number, vars?: Vars): string {
  return translateCount(language, key, count, vars, vocabulary);
}
