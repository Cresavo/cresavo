import { useSyncExternalStore } from "react";
import { formatTime } from "../../i18n/format";
import type { Booking } from "../../data/types";

/**
 * How much larger the reader's text is than the default 16 px (a larger browser or phone text size). The grid's
 * minutes grow with it, so a booking's name and time get the same room relative to the text instead of being cut.
 */
export function textScale(rootFontSize: number): number {
  return Number.isFinite(rootFontSize) && rootFontSize > 16 ? rootFontSize / 16 : 1;
}

function readTextScale() {
  return textScale(parseFloat(getComputedStyle(document.documentElement).fontSize));
}

export function useTextScale(): number {
  return useSyncExternalStore((listener) => {
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, readTextScale, () => 1);
}

/** Keep the time grid proportional when a short appointment needs more space. */
export function calendarScale(defaultScale: number, bookings: readonly Booking[], minHeight = 44) {
  // Reserve the touch target plus the two one-pixel gaps between events.
  return bookings.reduce((scale, booking) => Math.max(scale, (minHeight + 2) / booking.duration), defaultScale);
}

/**
 * The minutes a grid shows: the opening hours, widened to take in whole visits with their preparation and
 * clean-up, so a buffer after the day's last visit is drawn inside the grid and not past its edge.
 */
export function calendarRange(open: number, close: number, bookings: readonly Pick<Booking, "start" | "duration" | "bufferBefore" | "bufferAfter">[]) {
  return bookings.reduce(
    (range, b) => ({
      from: Math.min(range.from, b.start - (b.bufferBefore ?? 0)),
      to: Math.max(range.to, b.start + b.duration + (b.bufferAfter ?? 0)),
    }),
    { from: open, to: close },
  );
}

/** Hour labels down the left side of a calendar grid. */
export function TimeAxis({ from, to, pxPerMin }: { from: number; to: number; pxPerMin: number }) {
  const hours: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) hours.push(m);
  return (
    <div className="relative w-11 shrink-0" style={{ height: (to - from) * pxPerMin }}>
      {hours.map((m) => (
        <span key={m} className="absolute right-2 -translate-y-1/2 text-minimum tabular-nums text-text-secondary" style={{ top: (m - from) * pxPerMin }}>
          {formatTime(m)}
        </span>
      ))}
    </div>
  );
}

/** Horizontal hour lines behind a column. */
export function HourLines({ from, to, pxPerMin }: { from: number; to: number; pxPerMin: number }) {
  const lines: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) lines.push(m);
  return (
    <>
      {lines.map((m) => (
        <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-hairline" style={{ top: (m - from) * pxPerMin }} />
      ))}
    </>
  );
}

/**
 * The one now-line across a grid's columns, with the time in a small pill on the axis. Place it in the grid's body
 * (relative, `py-3`, axis first). Decorative: the heading already says which day it is.
 */
export function NowLine({ minutes, from, to, pxPerMin }: { minutes: number; from: number; to: number; pxPerMin: number }) {
  if (minutes <= from || minutes >= to) return null;
  return (
    <div aria-hidden data-calendar-now className="pointer-events-none absolute left-0 right-1 z-sticky flex h-0 items-center" style={{ top: `calc(var(--space-3) + ${(minutes - from) * pxPerMin}px)` }}>
      <span className="flex w-11 shrink-0 justify-end pr-1">
        <span className="rounded-xs bg-danger px-1 text-minimum font-semibold leading-4 text-surface tabular-nums">{formatTime(minutes)}</span>
      </span>
      <span className="-ml-1 size-2 shrink-0 rounded-full bg-danger" />
      <span className="h-0.5 flex-1 bg-danger" />
    </div>
  );
}
