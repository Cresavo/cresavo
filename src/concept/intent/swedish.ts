const DATE_WORDS: Record<string, string> = {
  måndag: "monday", tisdag: "tuesday", onsdag: "wednesday", torsdag: "thursday",
  fredag: "friday", lördag: "saturday", söndag: "sunday",
  idag: "today", imorgon: "tomorrow", igår: "yesterday",
  januari: "january", februari: "february", mars: "march", april: "april", maj: "may",
  juni: "june", juli: "july", augusti: "august", september: "september",
  oktober: "october", november: "november", december: "december",
  julafton: "christmas eve",
};

const dateWords = new RegExp(`(?<![\\p{L}])(?:${Object.keys(DATE_WORDS).join("|")})(?![\\p{L}])`, "gu");

export function swedishDates(text: string): string {
  return text
    .replace(/\bi\s+(dag|morgon|går)\b/g, "i$1")
    .replace(dateWords, (word) => DATE_WORDS[word])
    .replace(/\bden här veckan\b/g, "this week")
    .replace(/\bnästa vecka[n]?\b/g, "next week")
    .replace(/\bförra veckan\b/g, "last week")
    .replace(/\bden här månaden\b/g, "this month")
    .replace(/\bförra månaden\b/g, "last month")
    .replace(/\bförra året\b/g, "last year")
    .replace(/\b(förra|nästa) (?=monday|tuesday|wednesday|thursday|friday|saturday|sunday)/g, (word) => word.startsWith("förra") ? "last " : "next ");
}

const PHRASES: [RegExp, string][] = [
  [/^(?:flytta|omboka|boka om)\s+(?:(?:bokningen|tiden)\s+för\s+)?/i, "move "],
  [/^(?:avboka|ta bort bokningen för)\s+(?:(?:bokningen|tiden)\s+för\s+)?/i, "cancel "],
  [/^boka(?: in)?\s+/i, "book "],
  [/^stäng salongen\b/i, "close the salon"],
  [/^vem (?:är näst på tur|är nästa|kommer härnäst)\b/i, "who is next"],
  [/^(vem|vilka) kommer(?:\s+hit)?\b/i, "who is coming"],
  [/^vilka var här\b/i, "who was here"],
  [/^hur ser dagen ut\b/i, "morning brief"],
  [/^hur gick dagen\b/i, "closing summary"],
  [/^hur gick veckan\b/i, "weekly review"],
  [/^(?:finns det (?:någon )?(?:tid|plats)|har vi tid) för\b/i, "any room for"],
  [/^vad kostar\b/i, "what does"],
  [/^hur länge tar\b/i, "how long does"],
  [/^när (?:har ni öppet|öppnar ni)\b/i, "opening hours"],
  [/^vilka produkter börjar ta slut\b/i, "what is running low"],
  [/^hur (?:mycket|många) (.+?) (?:finns )?kvar/i, "how much $1 left"],
  [/^vad har jag tjänat\b|^hur mycket (?:har jag tjänat|tjänade jag)\b|^intäkter\b/i, "what have I earned"],
  [/^hur gick förra månaden jämfört med förra året\b/i, "how did last month compare with last year"],
  [/^vilka (?:kunder|klienter|patienter) har inte (?:kommit|varit här) sedan sommaren\b/i, "which customers haven't been here since summer"],
  [/^skicka dem ett erbjudande\b/i, "send them an offer"],
  [/^beställ(?: mer)?\b/i, "order"],
  [/^skapa (?:en )?kampanj för\b/i, "make a campaign for"],
  [/^kom ihåg (?:att )?/i, "remember "],
  [/^glöm\s+/i, "forget "],
  [/^vad kommer du ihåg(?: om)?\b/i, "what do you remember"],
  [/^(.+?) (?:jobbar|arbetar)\b/i, "$1 works"],
  [/^(.+?) är ledig\b/i, "$1 is off"],
];

/** Match Swedish command stems, then reuse the same intent and permission checks for both languages. */
export function normalizeSwedishCommand(input: string): string {
  const stem = PHRASES.find(([pattern]) => pattern.test(input));
  if (!stem) return input;
  const rewritten = input.replace(...stem);
  if (/^(?:remember|forget|what do you remember)\b/.test(rewritten)) return rewritten;
  const canonical = swedishDates(rewritten.toLowerCase())
    .replace(/\bpå (?=monday|tuesday|wednesday|thursday|friday|saturday|sunday)/g, "on ")
    .replace(/\b(?:klockan|kl\.?)\s+(\d{1,2})\.(\d{2})\b/g, "at $1:$2")
    .replace(/\b(?:klockan|kl\.?)\s+(?=\d)/g, "at ")
    .replace(/\b(?:på )?förmiddagen\b/g, "morning")
    .replace(/\b(?:på )?eftermiddagen\b/g, "afternoon")
    .replace(/\bmed\b|\bhos\b/g, "with")
    .replace(/\bväntelistan?\b/g, "waitlist");
  if (!canonical.startsWith("move ")) return canonical;
  const [source, destination] = canonical.split(/\s+till\s+/);
  if (!destination) return canonical;
  const time = source.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  // A destination day with no new clock time keeps the named original time.
  const dayOnly = /^(?:on )?(?:next )?(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})[.!?]*$/.test(destination);
  const target = time && dayOnly ? `${destination.replace(/[.!?]+$/, "")} at ${time}` : destination;
  return `${source} to ${target}`;
}
