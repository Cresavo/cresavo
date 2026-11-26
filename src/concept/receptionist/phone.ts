import type { Locale } from "@/lib/locale";

// Country codes whose national numbers start with a trunk 0 that is dropped after the country code
// ("+44 (0)20 …"). Not Denmark or Norway (no trunk 0) and not Italy (its 0 is part of the number).
const TRUNK_ZERO = ["46", "44", "49", "358", "31", "32", "33", "41", "43", "353"];

// Phone numbers as a caller says them. A number is always a string: Swedish
// numbers start with 0 (or +46), and a number without its leading 0 is not the
// number the caller said. So a bare number without the 0 is refused as unclear
// instead of being stored, and +46 / 0046 is written the Swedish way, with 0.

export type CallerPhone = { ok: true; phone: string } | { ok: false; reason: "missing_zero" | "unclear" };

const INPUT = /^\+?[\d\s().-]+$/;

/** How the salon's callers write numbers: whether national numbers start with a trunk 0, and whether the salon is in Sweden. */
export interface Dialing {
  trunkZero: boolean;
  swedish: boolean;
}

const SWEDEN: Dialing = { trunkZero: true, swedish: true };

/**
 * Read from the salon's own number (and currency, for a number written the national way): +46 or 0046 is Sweden;
 * a national 0… number is Sweden only for a salon that charges in SEK, and otherwise a country whose numbers
 * start with 0 like the salon's own. Written internationally, the country code says whether numbers there start with 0.
 */
export function salonDialing(salonPhone: string, currency: string): Dialing {
  const said = salonPhone.trim();
  const digits = said.replace(/\D/g, "");
  const international = said.startsWith("+") || digits.startsWith("00");
  if (international) {
    const code = digits.replace(/^00/, "");
    if (code.startsWith("46")) return SWEDEN;
    return { trunkZero: TRUNK_ZERO.some((candidate) => code.startsWith(candidate)), swedish: false };
  }
  if (digits.startsWith("0")) return { trunkZero: true, swedish: currency === "SEK" };
  return { trunkZero: false, swedish: false };
}

/**
 * The caller's number as it is kept. Where national numbers start with 0, one without it is refused as
 * misheard; elsewhere (as in the US) a bare national number is kept as said. Only a Swedish salon writes
 * +46 numbers the Swedish way, with 0; anywhere else they keep their country code so they can be dialled.
 */
export function callerPhone(raw: string, dialing: Dialing = SWEDEN): CallerPhone {
  const { trunkZero, swedish } = dialing;
  const said = raw.trim();
  if (!INPUT.test(said)) return { ok: false, reason: "unclear" };
  let digits = said.replace(/\D/g, "");
  const international = said.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^(\d)\1*$/.test(digits)) return { ok: false, reason: "unclear" };
  let phone: string;
  if (international && digits.startsWith("46") && swedish) phone = `0${digits.slice(2).replace(/^0/, "")}`;
  else if (international) {
    // "+44 (0)20 7946 0958": the 0 after the country code is not dialled from abroad.
    const code = TRUNK_ZERO.find((candidate) => digits.startsWith(candidate));
    phone = `+${code && digits[code.length] === "0" ? code + digits.slice(code.length + 1) : digits}`;
  } else if (digits.startsWith("0") || !trunkZero) phone = digits;
  else return { ok: false, reason: digits.length >= 6 ? "missing_zero" : "unclear" };
  const count = phone.replace(/\D/g, "").length;
  const wanted = swedish && !phone.startsWith("+") ? count >= 7 && count <= 11 : count >= 7 && count <= 15;
  if (!wanted || /^\+?(\d)\1+$/.test(phone)) return { ok: false, reason: "unclear" };
  return { ok: true, phone };
}

const ONES: Record<Locale, string[]> = {
  sv: ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
};
const TEENS: Record<Locale, string[]> = {
  sv: ["tio", "elva", "tolv", "tretton", "fjorton", "femton", "sexton", "sjutton", "arton", "nitton"],
  en: ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"],
};
const TENS: Record<Locale, string[]> = {
  sv: ["", "", "tjugo", "trettio", "fyrtio", "femtio", "sextio", "sjuttio", "åttio", "nittio"],
  en: ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"],
};

/** Two digits as one number ("sjuttio", "fyrtiofem"); a leading 0 stays a spoken "noll" ("noll fem"). */
function pair(digits: string, language: Locale): string {
  const [a, b] = [Number(digits[0]), Number(digits[1])];
  if (a === 0) return `${ONES[language][0]} ${ONES[language][b]}`;
  if (a === 1) return TEENS[language][b];
  if (b === 0) return TENS[language][a];
  return language === "sv" ? `${TENS.sv[a]}${ONES.sv[b]}` : `${TENS.en[a]}-${ONES.en[b]}`;
}

/** A group as people say it in one breath: pairs as numbers, an odd digit on its own first ("tre fyrtiofem"). */
function group(digits: string, language: Locale): string {
  const words: string[] = [];
  let left = digits;
  if (left.length % 2 === 1) {
    words.push(ONES[language][Number(left[0])]);
    left = left.slice(1);
  }
  for (let i = 0; i < left.length; i += 2) words.push(pair(left.slice(i, i + 2), language));
  return words.join(" ");
}

/** Splits digits into groups of three, the last of two to four ("345 6780", said "tre fyrtiofem, sextiosju åttio"). */
function groupRest(rest: string): string[] {
  const groups: string[] = [];
  let left = rest;
  while (left.length > 4) {
    groups.push(left.slice(0, 3));
    left = left.slice(3);
  }
  if (left) groups.push(left);
  return groups;
}

/**
 * The number as a Swedish receptionist reads it back, smoothly and in one go: the first 0 always said as
 * "noll", then the digits in the usual groups, each group as numbers ("noll sjuttio, tre fyrtiofem, sextisju åttio").
 */
export function spokenPhone(phone: string, language: Locale): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `plus ${[digits.slice(0, 2), ...groupRest(digits.slice(2))].map((g) => group(g, language)).join(", ")}`;
  // A national number without a 0 in front (a salon outside Sweden): every digit as said, in groups.
  if (!digits.startsWith("0")) return [digits.slice(0, 3), ...groupRest(digits.slice(3))].map((g) => group(g, language)).join(", ");
  const zero = ONES[language][0];
  // 08 (Stockholm) is its own area code; otherwise the first group is 0 plus two digits (070, 031, 012).
  const head = digits.startsWith("08") ? "8" : digits.slice(1, 3);
  const rest = digits.slice(1 + head.length);
  const tail = groupRest(rest);
  return [`${zero} ${head.length === 2 ? pair(head, language) : ONES[language][Number(head)]}`, ...tail.map((g) => group(g, language))].join(", ");
}
