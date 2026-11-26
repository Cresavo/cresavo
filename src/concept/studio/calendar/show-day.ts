"use client";

import { useEffect, useRef } from "react";
import { isDateKey } from "@/concept/data/dates";
import type { DateKey } from "@/concept/data/types";

/** Search asks the calendar to show a day, even when the ?date= link is already in the address. */

export const CALENDAR_SHOW_DAY = "cresavo:calendar-show-day";

export function requestCalendarDay(date: string) {
  window.dispatchEvent(new CustomEvent(CALENDAR_SHOW_DAY, { detail: date }));
}

/** Address after dropping ?date=, or null when it was not there. */
export function calendarUrlWithoutDate(href: string): string | null {
  const url = new URL(href, "http://local.invalid");
  if (!url.searchParams.has("date")) return null;
  url.searchParams.delete("date");
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/**
 * Drop ?date= from the address bar without a router navigation. A soft replace can stay in
 * flight or never update the history, and a later search for the same day is then a no-op.
 */
export function dropCalendarDateLink() {
  const next = calendarUrlWithoutDate(window.location.href);
  if (!next) return;
  window.history.replaceState(window.history.state, "", next);
}

export function useRequestedCalendarDay(onDay: (date: DateKey) => void) {
  const fn = useRef(onDay);
  useEffect(() => {
    fn.current = onDay;
  });
  useEffect(() => {
    const onShow = (event: Event) => {
      const date = (event as CustomEvent<unknown>).detail;
      if (typeof date === "string" && isDateKey(date)) fn.current(date);
    };
    window.addEventListener(CALENDAR_SHOW_DAY, onShow);
    return () => window.removeEventListener(CALENDAR_SHOW_DAY, onShow);
  }, []);
}
