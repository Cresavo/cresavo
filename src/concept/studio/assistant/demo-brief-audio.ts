import type { Brief } from "../../assistant/briefs";
import type { DateKey } from "../../data/types";
import { getActiveLocale } from "../../i18n";

// Pre-rendered Swedish readings of the default Salong Eko demo brief. The
// facts are the same on any weekday, written relative to today, with no
// weekday or calendar date in the recording. They are static files, with no
// ElevenLabs or OpenAI call at runtime. The clip is used only when the
// on-screen brief still has those exact facts; otherwise the browser reads
// the live text.

/** A stable demo day used by tests; the recordings themselves are not tied to it. */
export const DEMO_BRIEF_DAY: DateKey = "2026-11-17";

export const MORNING_BRIEF_CLIP = "/demo/brief/morning-elin.mp3";
export const EVENING_BRIEF_CLIP = "/demo/brief/evening-elin.mp3";

/** The morning recording greets "God morgon", so it is only used before noon. */
const MORNING_UNTIL = 12 * 60;

/** Item id (or id prefix ending in "-") and Swedish text of `morningBrief` at 09:00. */
export const RECORDED_MORNING_ITEMS = [
  ["bookings", "10 bokningar i dag, första kl. 09:00 hos Marie."],
  ["cancel-", "Lisa avbokade tiden kl. 14:45 i dag. Den är nu ledig."],
  ["inbox", "3 kunder väntar på svar."],
  ["stock-urea-cream", "Foot cream urea 10% börjar ta slut."],
  ["stock-massage-oil-neutral", "Massage oil, unscented börjar ta slut."],
  ["gaps", "4 lediga tider kvar i dag."],
  ["due-back", "22 kunder är aktuella för återbesök."],
] as const;

/** Evening recap lines for the recorded demo after the last booking (18:00). */
export const RECORDED_EVENING_SUMMARY =
  "Dagens intäkter: 6\u00a0370\u00a0kr från 10 besök.";
export const RECORDED_EVENING_HIGHLIGHTS = [
  "0 uteblivna besök",
  "1 avbokning",
  "0 nya kunder",
  "10 journalanteckningar saknas",
  "7 bokningar i morgon, först kl. 09:00 hos Björn.",
  "3 kunder väntar på svar.",
  "2 produkter börjar ta slut",
] as const;

function sameLines(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    actual.every((line, i) => line === expected[i])
  );
}

function isStandardSwedishDemo(today: string, generatedFor: string) {
  return getActiveLocale() === "sv" && generatedFor === today;
}

function matchesRecordedMorning(brief: Brief) {
  const items = brief.items.filter((item) => !item.id.startsWith("holiday-"));
  if (items.length !== RECORDED_MORNING_ITEMS.length) return false;
  return items.every((item, i) => {
    const [id, text] = RECORDED_MORNING_ITEMS[i];
    if (item.text !== text) return false;
    return id.endsWith("-") ? item.id.startsWith(id) : item.id === id;
  });
}

/**
 * When the Elin morning clip will play, drop the changing holiday line so the card shows the same facts as the recording.
 * If the clip is not eligible, the live brief is left alone, holiday included, and the browser reads it.
 */
export function recordedMorningBrief(
  brief: Brief,
  clock: { today: string; minutes: number },
  generatedFor: string,
): Brief {
  if (!morningBriefClipUrl(brief, clock, generatedFor)) return brief;
  return { ...brief, items: brief.items.filter((item) => !item.id.startsWith("holiday-")) };
}

/** The morning Elin clip, or null when the live brief no longer matches the recording. */
export function morningBriefClipUrl(
  brief: Brief,
  clock: { today: string; minutes: number },
  generatedFor: string,
): string | null {
  if (!isStandardSwedishDemo(clock.today, generatedFor)) return null;
  if (clock.minutes >= MORNING_UNTIL) return null;
  return matchesRecordedMorning(brief) ? MORNING_BRIEF_CLIP : null;
}

/** The evening Elin clip, or null when the live recap no longer matches the recording. */
export function eveningBriefClipUrl(
  recap: { summary: string; highlights: string[] },
  clock: { today: string },
  generatedFor: string,
): string | null {
  if (!isStandardSwedishDemo(clock.today, generatedFor)) return null;
  if (recap.summary !== RECORDED_EVENING_SUMMARY) return null;
  if (!sameLines(recap.highlights, RECORDED_EVENING_HIGHLIGHTS)) return null;
  return EVENING_BRIEF_CLIP;
}
