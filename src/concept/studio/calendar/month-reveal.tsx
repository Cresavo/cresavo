"use client";

import { useId, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { monthKey } from "../../data/dates";
import type { DateKey } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { MonthGrid, type DayInfo } from "../../ui/month-grid";

const SWIPE = 40;

/** A vertical swipe that did not scroll the page: up is -1, down is 1. */
export function swipeDirection(dx: number, dy: number, scrolled: boolean): -1 | 0 | 1 {
  if (scrolled || Math.abs(dy) < SWIPE || Math.abs(dy) <= Math.abs(dx)) return 0;
  return dy < 0 ? -1 : 1;
}

interface MonthRevealProps {
  heading: ReactNode;
  /** The navigation row; the Month button joins its end. */
  toolbar: ReactNode;
  date: DateKey;
  today: DateKey;
  onPick: (date: DateKey) => void;
  info: (date: DateKey) => DayInfo;
}

/**
 * The calendar's heading with a month under it. On a phone a swipe up on the heading shows the month and a
 * swipe down hides it, so the day gets the room back; the Month button does the same for everyone.
 */
export function MonthReveal({ heading, toolbar, date, today, onPick, info }: MonthRevealProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  if (open && !present) setPresent(true);
  // Browsing to another month lasts until the shown day changes.
  const [browse, setBrowse] = useState<{ from: DateKey; month: string }>();
  const month = browse?.from === date ? browse.month : monthKey(date);
  const start = useRef<{ x: number; y: number; scroll: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    start.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, scroll: window.scrollY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const from = start.current;
    start.current = null;
    const touch = event.changedTouches[0];
    if (!from || !touch) return;
    const direction = swipeDirection(touch.clientX - from.x, touch.clientY - from.y, window.scrollY !== from.scroll);
    if (direction) setOpen(direction < 0);
  };

  return (
    <div className="mb-4 space-y-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { start.current = null; }}>
      <div className="studio-swipe flex flex-wrap items-center gap-2">{heading}</div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">{toolbar}</div>
        {/* Icon only on a phone, so it fits the toolbar row; the name stays for screen readers. */}
        <Button data-help-id="calendar.month" variant="tertiary" size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
          icon={<CalendarDays size={18} aria-hidden />} className={cx("ml-auto shrink-0 max-sm:px-0", open && "bg-surface-2")}>
          <span className="max-sm:sr-only">{t("calendar.month")}</span>
          <ChevronDown size={16} aria-hidden className={cx("transition-transform duration-normal ease-enter max-sm:hidden", open && "rotate-180")} />
        </Button>
      </div>
      {present && (
        <div id={id} data-closing={!open || undefined} className="studio-month-reveal studio-swipe border-b border-hairline pb-4 pt-2"
          onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) setPresent(false); }}>
          <MonthGrid month={month} today={today} selected={date} label={t("calendar.month.days")}
            onMonth={(next) => setBrowse({ from: date, month: next })}
            onSelect={onPick} info={info} />
        </div>
      )}
    </div>
  );
}
