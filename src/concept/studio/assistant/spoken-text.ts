import { sensitiveKind } from "../../assistant/memory";
import type { Reply } from "../../assistant/thread";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { normalize } from "../../intent/match";
import { fullName } from "../../selectors";

// What may be read aloud from a reply, in a room where others can hear. The
// screen keeps the full reply; only the spoken line is filtered. Health and
// journal details, phone numbers, emails and addresses are never read: the line
// then says the details are on the screen. A customer is named by first name
// only, and a list of many customers is not read out.

type SpeechState = Pick<DemoState, "customers" | "services" | "journals">;

/** More customers than this in one line is a list: it stays on the screen. */
const MAX_SPOKEN_CUSTOMERS = 3;
/** A quoted piece of a longer journal entry at least this long counts as journal text. */
const MIN_JOURNAL_QUOTE = 12;
/** A complete short field (treatment, observations, advice) still counts if it has this many letters. */
const MIN_JOURNAL_FIELD = 6;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (text: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(?![\\p{L}\\p{N}])`, "giu");
/** A full name, also in the Swedish genitive ("Lena Bergs"). */
const nameWord = (text: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(s?)(?![\\p{L}\\p{N}])`, "giu");

/** Four consecutive journal words in the spoken line: enough to catch an excerpt, not a short common phrase. */
const MIN_JOURNAL_WORDS = 4;

function quotesWords(journal: string, spoken: string): boolean {
  const words = journal.split(" ").filter(Boolean);
  if (words.length < MIN_JOURNAL_WORDS) return false;
  const haystack = ` ${spoken} `;
  for (let start = 0; start + MIN_JOURNAL_WORDS <= words.length; start++) {
    if (haystack.includes(` ${words.slice(start, start + MIN_JOURNAL_WORDS).join(" ")} `)) return true;
  }
  return false;
}

const SCHEDULE_FIELD = /^(?:today|tomorrow|tonight|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|next week|this week|last week|\d+ weeks?|\d{4}-\d{2}-\d{2})$/;

/** A complete short journal field, as whole words, even when it is shorter than MIN_JOURNAL_QUOTE. */
function quotesShortField(field: string, spoken: string): boolean {
  const value = normalize(field);
  if (!value || value.length < MIN_JOURNAL_FIELD || SCHEDULE_FIELD.test(value)) return false;
  return ` ${spoken} `.includes(` ${value} `);
}

/** Whether the text repeats a sentence of any journal entry, or a meaningful part of one. */
function quotesJournal(text: string, state: SpeechState): boolean {
  const spoken = normalize(text);
  if (state.journals.some((entry) => [entry.treatment, entry.observations, entry.advice].some((field) => quotesShortField(field, spoken)))) return true;
  if (spoken.length < MIN_JOURNAL_QUOTE) return false;
  return state.journals
    .flatMap((entry) => [entry.treatment, entry.observations, entry.advice, entry.nextVisit ?? ""])
    .flatMap((field) => [field, ...field.split(/[.!?;\n]+/)])
    .map(normalize)
    .some((sentence) => sentence.length >= MIN_JOURNAL_QUOTE && (spoken.includes(sentence) || (spoken.length >= MIN_JOURNAL_QUOTE && sentence.includes(spoken)) || quotesWords(sentence, spoken)));
}


const WHEN_OR_WHERE = /^(?:on|at|in|for|a|an|the|and|or|of|to|from|with|next|this|last|is|are|due|booked|appointment|booking|today|tomorrow|tonight|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|week|month|year|am|pm|o'?clock|\d{1,4}|\d{1,2}:\d{2})$/;

/** True when, after treatment names are removed, only a day or a time is left. */
function onlyWhenOrWhere(text: string): boolean {
  const leftover = normalize(text);
  if (!leftover) return true;
  return leftover.split(" ").every((token) => WHEN_OR_WHERE.test(token));
}

/** The line to read aloud for any text, or null when there is nothing to say. */
export function safeSpeech(text: string, state: SpeechState): string | null {
  const plain = text.replace(/\s+/g, " ").trim();
  if (!plain) return null;
  // A treatment's name is the salon's menu. If the rest of the line is only when
  // or where ( "Medical foot care tomorrow at 10:00" ), it can be read even if
  // those words also appear in a journal or match a health word. Any other
  // leftover wording is checked against the original line, so "She has eczema"
  // is never read just because a treatment is named Eczema.
  const withoutServices = state.services.reduce((out, service) => out.replace(word(service.name), " "), plain);
  if (!onlyWhenOrWhere(withoutServices) && (sensitiveKind(plain, state) || quotesJournal(plain, state) || quotesJournal(withoutServices, state))) {
    return t("assistant.voice.onScreen");
  }
  let named = 0;
  let spoken = plain;
  // Longest names first, so "Anna Berg Lind" is not read as "Anna Lind".
  const customers = [...state.customers].sort((a, b) => fullName(b).length - fullName(a).length);
  for (const customer of customers) {
    const name = nameWord(fullName(customer));
    if (!spoken.match(name)) continue;
    named++;
    spoken = spoken.replace(nameWord(fullName(customer)), `${customer.firstName}$1`);
  }
  // A surname on its own, or a genitive of it, is still that person: say the first
  // name. A shared surname cannot be reduced to one person, so it stays on the screen.
  const byLast = new Map<string, typeof customers>();
  for (const customer of customers) {
    const last = customer.lastName.trim();
    if (!last) continue;
    const key = normalize(last);
    byLast.set(key, [...(byLast.get(key) ?? []), customer]);
  }
  for (const group of [...byLast.values()].sort((a, b) => b[0].lastName.length - a[0].lastName.length)) {
    const last = nameWord(group[0].lastName.trim());
    if (!spoken.match(last)) continue;
    if (group.length > 1) return t("assistant.voice.onScreen");
    named++;
    spoken = spoken.replace(nameWord(group[0].lastName.trim()), `${group[0].firstName}$1`);
  }
  if (named > MAX_SPOKEN_CUSTOMERS) return t("assistant.voice.onScreen");
  return spoken;
}

/**
 * The spoken version of a reply. A proposal is described, never confirmed: the line ends by pointing at the
 * card, since approving stays a tap on the screen.
 */
export function spokenReply(reply: Reply, state: SpeechState): string | null {
  const card = reply.card;
  const parts = [reply.text];
  if (card?.kind === "change") parts.push(card.title, t("assistant.voice.approveOnScreen"));
  else if (card?.kind === "choose") parts.push(t("assistant.voice.pickOnScreen"));
  else if (card?.kind === "memory-offer" || card?.kind === "routine-offer") parts.push(t("assistant.voice.answerOnScreen"));
  const sentences = parts.map((part) => part.trim()).filter(Boolean).map((part) => (/[.!?]$/.test(part) ? part : `${part}.`));
  return safeSpeech(sentences.join(" "), state);
}
