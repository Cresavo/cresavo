import type { Interval } from "../../data/types";
import { t } from "../../i18n";

/** The soft lunch wash inside one working column. */
export function LunchWash({ lunch, from, scale }: { lunch: Interval; from: number; scale: number }) {
  return (
    <div
      aria-hidden
      className="studio-calendar-lunch pointer-events-none absolute inset-x-0"
      style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale }}
    />
  );
}

/**
 * The one "Lunch" word for a day. It is drawn inside the first working column, before that column's bookings, and
 * spans to the last working column, so it sits over the people who work. Its layer (studio.css) keeps it above the
 * lunch washes and behind every booking.
 */
export function LunchLabel({ lunch, from, scale, span }: { lunch: Interval; from: number; scale: number; span: number }) {
  return (
    <div
      className="studio-calendar-lunch-label pointer-events-none absolute left-0 flex items-center justify-center text-minimum text-text-secondary"
      style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale, width: `${span * 100}%` }}
    >
      {t("calendar.lunch")}
    </div>
  );
}

/** Where the day's lunch label goes: the first working column and how many columns it spans to the last one. */
export function lunchSpan(works: boolean[]): { first: number; span: number } | null {
  const first = works.indexOf(true);
  if (first < 0) return null;
  return { first, span: works.lastIndexOf(true) - first + 1 };
}
