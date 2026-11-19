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

const SALE_QUANTITIES: Record<string, string> = { en: "one", ett: "one", två: "two", tre: "three" };

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
  [/^(?:vad kostar|hur mycket kostar|vad (?:är|ligger) priset på|vad tar (?:vi|ni) för)\s+/i, "what does "],
  [/^(?:sätt(?:a)?|ändra|uppdatera|höj(?:a)?|sänk(?:a)?|justera)\s+(?:priset\s+(?:på|för)\s+)?(.+?)\s+till\s+(?=\d)/i, "set price of $1 to "],
  [/^(?:sätt(?:a)?|ändra|höj(?:a)?|sänk(?:a)?) priset (?:på|för)\s+/i, "set price of "],
  [/^priset (?:på|för) (.+?) ska (?:vara|bli)\s+/i, "set price of $1 to "],
  [/^hur länge tar\b/i, "how long does"],
  [/^när (?:har ni öppet|öppnar ni)\b/i, "opening hours"],
  [/^(?:vilka produkter börjar ta slut|vad (?:börjar|håller på att) ta slut|vad behöver (?:vi|jag) beställa)\b/i, "what is running low"],
  [/^hur (?:mycket|många) (?:har vi |har jag |finns det )?kvar av\s+(.+?)[.!?]*$/i, "how much $1 left"],
  [/^hur (?:mycket|många) (.+?) (?:har (?:vi|jag) |finns (?:det )?)?(?:kvar|(?:i|på) lager)\b/i, "how much $1 in stock"],
  [/^(?:finns det|har (?:vi|jag)|finns) (.+?) (?:kvar|(?:i|på) lager)\b/i, "do i have $1 in stock"],
  [/^(?:sålde|sälj(?:a)?)\s+(.+?)\s+till\s+/i, "sell $1 to "],
  [/^vad har jag tjänat\b|^hur mycket (?:har jag tjänat|tjänade jag)\b|^intäkter\b/i, "what have I earned"],
  [/^hur gick förra månaden jämfört med förra året\b/i, "how did last month compare with last year"],
  [/^vilka (?:kunder|klienter|patienter) har inte (?:kommit|varit här) sedan sommaren\b/i, "which customers haven't been here since summer"],
  [/^skicka dem ett erbjudande\b/i, "send them an offer"],
  [/^(?:beställ(?:a)?|köp(?:a)? in|fyll(?:a)? på(?: (?:lagret )?med)?|lägg(?:a)? (?:en )?beställning på|ta hem)(?: mer| fler)?(?=\s|[.!?]|$)/i, "order"],
  [/^(?:(?:skapa|gör(?:a)?|starta|kör(?:a)?|lägg(?:a)? upp)\s+)?(?:en\s+)?kampanj(?=\s|[.!?]|$)/i, "make a campaign"],
  [/^(?:skapa|gör(?:a)?|lägg(?:a)? upp)\s+(?:ett\s+)?erbjudande\b/i, "make an offer"],
  [/^(?:skapa|gör(?:a)?|ta fram)\s+(?:en\s+)?affisch(?:\s+för)?\b/i, "make a poster for"],
  [/^(?:ge|erbjud)?\s*(\d+(?:[.,]\d+)?\s*(?:%|procent))(?=\s+rabatt)/i, "$1"],
  [/^kom ihåg (?:att )?/i, "remember "],
  [/^glöm\s+/i, "forget "],
  [/^vad kommer du ihåg(?: om)?\b/i, "what do you remember"],
  [/^(.+?) (?:jobbar|arbetar)\b/i, "$1 works"],
  [/^(.+?) är ledig\b/i, "$1 is off"],
];

/** Match Swedish command stems, then reuse the same intent and permission checks for both languages. */
export function normalizeSwedishCommand(input: string): string {
  const request = input.replace(/^(?:kan du|skulle du kunna|jag vill)\s+/i, "");
  const stem = PHRASES.find(([pattern]) => pattern.test(request));
  if (!stem) return input;
  const rewritten = request.replace(...stem);
  if (/^(?:remember|forget|what do you remember)\b/.test(rewritten)) return rewritten;
  const canonical = swedishDates(rewritten.toLowerCase())
    .replace(/\bpå (?=monday|tuesday|wednesday|thursday|friday|saturday|sunday)/g, "on ")
    .replace(/\b(?:klockan|kl\.?)\s+(\d{1,2})\.(\d{2})\b/g, "at $1:$2")
    .replace(/\b(?:klockan|kl\.?)\s+(?=\d)/g, "at ")
    .replace(/\b(?:på )?förmiddag(?:en)?\b/g, "morning")
    .replace(/\b(?:på )?eftermiddag(?:en)?\b/g, "afternoon")
    .replace(/\bmed\b|\bhos\b/g, "with")
    .replace(/\bväntelistan?\b/g, "waitlist");
  if (canonical.startsWith("set price of ")) {
    return canonical.replace(/\bto (\d{1,3}(?:[ \u00a0]\d{3})+)(?=(?:[.,]\d+)?(?:\s|[.!?]|$))/, (_, amount: string) =>
      `to ${amount.replace(/[ \u00a0]/g, "")}`,
    ).replace(/(\d)\s+kronor\b/g, "$1 kr");
  }
  if (canonical.startsWith("sell ")) {
    return canonical.replace(/^sell (en|ett|två|tre) /, (_, count: string) => `sell ${SALE_QUANTITIES[count]} `);
  }
  if (/^(?:make (?:a campaign|an offer|a poster)|\d)/.test(canonical)) {
    return canonical
      .replace(/(\d)\s+procent\b/g, "$1 percent")
      .replace(/\brabatt\b/g, "discount")
      .replace(/\balla hjärtans dag\b/g, "valentine's day")
      .replace(/\bmors dag\b/g, "mother's day")
      .replace(/\bfars dag\b/g, "father's day")
      .replace(/\bförsta advent\b/g, "first advent")
      .replace(/\bmidsommar\b/g, "midsummer")
      .replace(/\bpåsk(?:en)?\b/g, "easter")
      .replace(/\bjul(?:en)?\b/g, "christmas")
      .replace(/\bnyår(?:et)?\b/g, "new year");
  }
  if (!canonical.startsWith("move ")) return canonical;
  const [source, destination] = canonical.split(/\s+till\s+/);
  if (!destination) return canonical;
  const time = source.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  // A destination day with no new clock time keeps the named original time.
  const dayOnly = /^(?:on )?(?:next )?(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})[.!?]*$/.test(destination);
  const target = time && dayOnly ? `${destination.replace(/[.!?]+$/, "")} at ${time}` : destination;
  return `${source} to ${target}`;
}
