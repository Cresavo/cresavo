"use client";

import type { DragEvent, MouseEvent } from "react";
import { formatTime } from "../../data/dates";
import { lunchFor, openingFor, staffWorks } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { t, tc } from "../../i18n";
import { dayBookings } from "../../selectors";
import { dispatch, undo } from "../../store";
import { cx } from "../../ui/cx";
import { showToast } from "../../ui/toast";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";
import { BookingBlock, DRAG_TYPE } from "./block";
import { HourLines, TimeAxis } from "./time-axis";

const PX_PER_MIN = 1.25;

const snap = (minutes: number) => Math.floor(minutes / 15) * 15;

/** One column per staff member for a single day. Tap a free spot to book, drag a booking to move it. */
export function DayGrid({ date, staff, onOpen }: { date: DateKey; staff: Staff[]; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const hours = openingFor(state.salon, date)!;
  const lunch = lunchFor(state.salon, date);
  const { open: from, close: to } = hours;
  const height = (to - from) * PX_PER_MIN;
  const minuteAt = (event: { clientY: number; currentTarget: Element }) =>
    snap(from + (event.clientY - event.currentTarget.getBoundingClientRect().top) / PX_PER_MIN);

  const onColumnClick = (person: Staff) => (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onOpen({ kind: "new", preset: { staffId: person.id, date, start: minuteAt(event) } });
  };

  const onDrop = (person: Staff) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) return;
    if (booking.staffId !== person.id) {
      showToast(t("calendar.sameStaffOnly", { name: state.staff.find((s) => s.id === booking.staffId)!.firstName }));
      return;
    }
    const start = minuteAt(event);
    if (dispatch({ type: "booking/move", id, date, start })) {
      showToast(t("calendar.movedTo", { time: formatTime(start) }), { label: t("common.undo"), run: undo });
    } else {
      showToast(t("calendar.slotTaken"));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-eko-surface shadow-card ring-1 ring-eko-line/70">
      <div className="flex border-b border-eko-line">
        <div className="w-11 shrink-0" />
        {staff.map((person) => (
          <div key={person.id} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-sm">
            <StaffDot staffId={person.id} />
            <span className="truncate font-medium">{person.firstName}</span>
            <span className="truncate text-xs text-eko-muted">
              {staffWorks(person, state.salon, date) ? tc("calendar.bookingCount", dayBookings(state, date, person.id).length) : t("calendar.off")}
            </span>
          </div>
        ))}
      </div>
      <div className="flex py-3 pr-1">
        <TimeAxis from={from} to={to} pxPerMin={PX_PER_MIN} />
        {staff.map((person) => {
          const works = staffWorks(person, state.salon, date);
          return (
            <div
              key={person.id}
              onClick={works ? onColumnClick(person) : undefined}
              onDragOver={(event) => works && event.preventDefault()}
              onDrop={works ? onDrop(person) : undefined}
              className={cx("relative min-w-0 flex-1 border-l border-eko-line/70", works ? "cursor-copy" : "bg-eko-sunken/70")}
              style={{ height }}
            >
              <HourLines from={from} to={to} pxPerMin={PX_PER_MIN} />
              {lunch && works && (
                <div
                  className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(var(--eko-line)/0.6)_6px_7px)] text-[11px] text-eko-muted"
                  style={{ top: (lunch.start - from) * PX_PER_MIN, height: (lunch.end - lunch.start) * PX_PER_MIN }}
                >
                  {t("calendar.lunch")}
                </div>
              )}
              {works &&
                dayBookings(state, date, person.id).map((b) => (
                  <BookingBlock
                    key={b.id}
                    booking={b}
                    top={(b.start - from) * PX_PER_MIN + 1}
                    height={b.duration * PX_PER_MIN - 2}
                    onOpen={() => onOpen({ kind: "booking", id: b.id })}
                  />
                ))}
              {date === today && minutes > from && minutes < to && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-eko-danger" style={{ top: (minutes - from) * PX_PER_MIN }}>
                  <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-eko-danger" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
