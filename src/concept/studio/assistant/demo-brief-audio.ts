import { morningBrief, type Brief } from "../../assistant/briefs";
import { matchesStandardDemoDay } from "../../data/generate";
import type { DateKey, DemoState } from "../../data/types";
import { getActiveLocale, t, translate, type MessageKey } from "../../i18n";
import { dayBookings } from "../../selectors";
import { eveningRecap } from "../../summary/day";

// Pre-rendered Elin readings of the default Salong Eko demo brief, in English
// and Swedish. The facts are the same on any weekday, written relative to
// today, with no weekday or calendar date in the recording. They are static
// files, with no ElevenLabs or OpenAI call at runtime. The clip is used only
// when the on-screen brief still has those facts (an upcoming holiday is
// ignored, because its wording changes with the date); otherwise the browser
// reads the live text, holiday included.

/** A stable demo day used by tests; the recordings themselves are not tied to it. */
export const DEMO_BRIEF_DAY: DateKey = "2026-11-17";

export const MORNING_BRIEF_CLIP = "/demo/brief/morning-elin.mp3";
export const EVENING_BRIEF_CLIP = "/demo/brief/evening-elin.mp3";
export const MORNING_BRIEF_CLIP_EN = "/demo/brief/morning-elin-en.mp3";
export const EVENING_BRIEF_CLIP_EN = "/demo/brief/evening-elin-en.mp3";

/** Item id (or id prefix ending in "-") and Swedish text of `morningBrief`. */
export const RECORDED_MORNING_ITEMS = [
  ["bookings", "10 bokningar i dag, första kl. 09:00 hos Marie."],
  ["cancel-", "Lisa avbokade tiden kl. 14:45 i dag. Den är nu ledig."],
  ["inbox", "3 kunder väntar på svar."],
  ["stock-urea-cream", "Foot cream urea 10% börjar ta slut."],
  ["stock-massage-oil-neutral", "Massage oil, unscented börjar ta slut."],
  ["gaps", "4 lediga tider kvar i dag."],
  ["due-back", "22 kunder är aktuella för återbesök."],
] as const;

/** English text of the same morning facts. */
export const RECORDED_MORNING_ITEMS_EN = [
  ["bookings", "10 bookings today, first at 09:00 with Marie."],
  ["cancel-", "Lisa cancelled 14:45 today: the slot is free."],
  ["inbox", "3 customers are waiting for a reply."],
  ["stock-urea-cream", "Foot cream urea 10% is running low."],
  ["stock-massage-oil-neutral", "Massage oil, unscented is running low."],
  ["gaps", "4 free slots left today."],
  ["due-back", "22 customers are due back."],
] as const;

/** Evening recap lines for the recorded Swedish demo after the last booking (18:00). */
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

export const RECORDED_EVENING_SUMMARY_EN =
  "Today's revenue: SEK\u00a06,370 from 10 visits.";
export const RECORDED_EVENING_HIGHLIGHTS_EN = [
  "0 no-shows",
  "1 cancellation",
  "0 new customers",
  "10 missing journals",
  "7 bookings tomorrow, first at 09:00 with Björn.",
  "3 customers are waiting for a reply.",
  "2 products are running low",
] as const;

type MorningItems = typeof RECORDED_MORNING_ITEMS | typeof RECORDED_MORNING_ITEMS_EN;

type LocaleClips = {
  morningUrl: string;
  eveningUrl: string;
  morningItems: MorningItems;
  eveningSummary: string;
  eveningHighlights: readonly string[];
};

const SWEDISH: LocaleClips = {
  morningUrl: MORNING_BRIEF_CLIP,
  eveningUrl: EVENING_BRIEF_CLIP,
  morningItems: RECORDED_MORNING_ITEMS,
  eveningSummary: RECORDED_EVENING_SUMMARY,
  eveningHighlights: RECORDED_EVENING_HIGHLIGHTS,
};

const ENGLISH: LocaleClips = {
  morningUrl: MORNING_BRIEF_CLIP_EN,
  eveningUrl: EVENING_BRIEF_CLIP_EN,
  morningItems: RECORDED_MORNING_ITEMS_EN,
  eveningSummary: RECORDED_EVENING_SUMMARY_EN,
  eveningHighlights: RECORDED_EVENING_HIGHLIGHTS_EN,
};

function clipsForLocale(): LocaleClips | null {
  const locale = getActiveLocale();
  if (locale === "sv") return SWEDISH;
  if (locale === "en") return ENGLISH;
  return null;
}

function sameLines(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    actual.every((line, i) => line === expected[i])
  );
}

function isStandardDemo(today: string, generatedFor: string) {
  return generatedFor === today;
}

const STOCK_NAME_KEYS = {
  "urea-cream": "fixture.eko.stock.urea-cream",
  "massage-oil-neutral": "fixture.eko.stock.massage-oil-neutral",
} as const satisfies Record<string, MessageKey>;

function allowedStockTexts(stockId: string, recordedText: string) {
  const key = STOCK_NAME_KEYS[stockId as keyof typeof STOCK_NAME_KEYS];
  if (!key) return [recordedText];
  const names = [translate("en", key), translate("sv", key)];
  return [...new Set([recordedText, ...names.map((name) => t("brief.lowStock", { name }))])];
}

function matchesRecordedMorning(
  brief: Brief,
  items: MorningItems,
  options: { allowTranslatedStockNames?: boolean } = {},
) {
  const live = brief.items.filter((item) => !item.id.startsWith("holiday-"));
  if (live.length !== items.length) return false;
  return live.every((item, i) => {
    const [id, text] = items[i];
    const sameId = id.endsWith("-") ? item.id.startsWith(id) : item.id === id;
    if (!sameId) return false;
    if (options.allowTranslatedStockNames && item.id.startsWith("stock-")) {
      return allowedStockTexts(item.id.slice("stock-".length), text).includes(item.text);
    }
    return item.text === text;
  });
}

function hasLaterBookingNotice(recorded: Brief, live: Brief) {
  const recordedIds = new Set(recorded.items.map((item) => item.id));
  return live.items.some((item) => item.id.startsWith("notice-") && !recordedIds.has(item.id));
}

function matchesRecordedEvening(
  recap: { summary: string; highlights: string[] },
  clips: LocaleClips,
) {
  return recap.summary === clips.eveningSummary && sameLines(recap.highlights, clips.eveningHighlights);
}


/** Morning and evening Elin clips for the Recorded readings card. Offered when this is still the pinned Salong Eko demo day and the live facts still match the recording, allowing the known English and Swedish product names in the morning stock lines. */
export function standardDemoRecordingClips(
  state: DemoState,
  today: string,
  generatedFor: string,
  minutes: number,
): { morningUrl: string | null; eveningUrl: string | null } | null {
  if (generatedFor !== today) return null;
  if (state.pack !== "foot-massage" || state.industry) return null;
  if (!matchesStandardDemoDay(state.bookings, today)) return null;
  const clips = clipsForLocale();
  if (!clips) return null;
  const morning = morningBrief(state, { today, minutes: 9 * 60 });
  const live = minutes === 9 * 60 ? morning : morningBrief(state, { today, minutes });
  const lastEnd = Math.max(0, ...dayBookings(state, today).map((booking) => booking.start + booking.duration));
  const evening = eveningRecap(state, { today, minutes: lastEnd });
  const morningUrl =
    !hasLaterBookingNotice(morning, live) &&
    matchesRecordedMorning(morning, clips.morningItems, { allowTranslatedStockNames: true })
      ? clips.morningUrl
      : null;
  const eveningUrl = matchesRecordedEvening(evening, clips) ? clips.eveningUrl : null;
  if (!morningUrl && !eveningUrl) return null;
  return { morningUrl, eveningUrl };
}

/** Live morning readings stop at noon: the clip greets with “God morgon” / “Good morning”, while the live card then uses the daytime title. The recorded-readings card still passes 09:00 so it can play later. */
const MORNING_UNTIL = 12 * 60;

/** The morning Elin clip in the Studio language, or null when the live brief no longer matches the recording or it is past noon. */
export function morningBriefClipUrl(
  brief: Brief,
  clock: { today: string; minutes: number },
  generatedFor: string,
): string | null {
  if (!isStandardDemo(clock.today, generatedFor)) return null;
  if (clock.minutes >= MORNING_UNTIL) return null;
  const clips = clipsForLocale();
  if (!clips) return null;
  return matchesRecordedMorning(brief, clips.morningItems) ? clips.morningUrl : null;
}

/** The evening Elin clip in the Studio language, or null when the live recap no longer matches the recording. */
export function eveningBriefClipUrl(
  recap: { summary: string; highlights: string[] },
  clock: { today: string },
  generatedFor: string,
): string | null {
  if (!isStandardDemo(clock.today, generatedFor)) return null;
  const clips = clipsForLocale();
  if (!clips) return null;
  return matchesRecordedEvening(recap, clips) ? clips.eveningUrl : null;
}

/** The 09:00 brief when it still matches the recording, so the card and Elin stay in step after free slots or a cancellation drop off later in the day. */
export function standardDemoMorningBrief(state: DemoState, today: string, generatedFor: string, minutes: number): Brief | null {
  const recorded = morningBrief(state, { today, minutes: 9 * 60 });
  if (!morningBriefClipUrl(recorded, { today, minutes: 9 * 60 }, generatedFor)) return null;
  // A later unread booking-page notice must not be hidden by the 09:00 snapshot.
  const live = minutes === 9 * 60 ? recorded : morningBrief(state, { today, minutes });
  const recordedIds = new Set(recorded.items.map((item) => item.id));
  if (live.items.some((item) => item.id.startsWith("notice-") && !recordedIds.has(item.id))) return null;
  return recorded;
}
