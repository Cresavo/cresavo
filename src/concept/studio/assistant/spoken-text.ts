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
/** A quoted piece of a journal entry at least this long counts as journal text. */
const MIN_JOURNAL_QUOTE = 12;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (text: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(?![\\p{L}\\p{N}])`, "giu");
/** A full name, also in the Swedish genitive ("Lena Bergs"). */
const nameWord = (text: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(s?)(?![\\p{L}\\p{N}])`, "giu");

/** Whether the text repeats a sentence of any journal entry. */
function quotesJournal(text: string, state: SpeechState): boolean {
  const spoken = normalize(text);
  return state.journals
    .flatMap((entry) => [entry.treatment, entry.observations, entry.advice, entry.nextVisit ?? ""])
    .flatMap((field) => field.split(/[.!?;\n]+/))
    .map(normalize)
    .some((sentence) => sentence.length >= MIN_JOURNAL_QUOTE && spoken.includes(sentence));
}

/** The line to read aloud for any text, or null when there is nothing to say. */
export function safeSpeech(text: string, state: SpeechState): string | null {
  const plain = text.replace(/\s+/g, " ").trim();
  if (!plain) return null;
  // A treatment's name ("Medical foot care", "Ingrown nail treatment") is the salon's menu, not anyone's health.
  const withoutServices = state.services.reduce((out, service) => out.replace(word(service.name), " "), plain);
  if (sensitiveKind(withoutServices, state) || quotesJournal(withoutServices, state)) return t("assistant.voice.onScreen");
  let named = 0;
  let spoken = plain;
  // Longest names first, so "Anna Berg Lind" is not read as "Anna Lind".
  for (const customer of [...state.customers].sort((a, b) => fullName(b).length - fullName(a).length)) {
    const name = nameWord(fullName(customer));
    if (!name.test(spoken)) continue;
    named++;
    spoken = spoken.replace(name, `${customer.firstName}$1`);
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
