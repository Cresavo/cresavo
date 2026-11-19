"use client";

import { formatTime } from "../../i18n/format";
import type { DragEvent, MouseEvent } from "react";
import { lunchFor, openingFor, staffWorks, workWindow } from "../../data/slots";
import type { DateKey, DemoState, Staff, StaffId } from "../../data/types";
import { t, tc } from "../../i18n";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import { showActionFailure } from "../../ui/toast";
import type { OpenSheet } from "../booking/booking-sheets";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";
import { BookingBlock, DRAG_TYPE } from "./block";
import { HourLines, TimeAxis } from "./time-axis";

const PX_PER_MIN = 1.25;

const snap = (minutes: number) => Math.floor(minutes / 15) * 15;

/** "3 bookings", or what is wrong when the person is not working but has bookings left. */
function dayHeading(state: DemoState, staffId: StaffId, date: DateKey, resourceId?: string) {
  const count = dayBookings(state, date, staffId, resourceId).length;
  if (staffWorks(state, staffId, date)) return tc("calendar.bookingCount", count);
  return count ? tc("calendar.offToMove", count) : t("calendar.off");
}

/** One column per staff member for a single day. Tap a free spot to book, drag a booking to move it. */
export function DayGrid({ date, staff, resourceId, onOpen }: { date: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void }) {
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
      const name = state.staff.find((s) => s.id === booking.staffId)!.firstName;
      showActionFailure("reference.sameStaffOnly", undefined, "studio", t("calendar.sameStaffOnly", { name }));
      return;
    }
    const start = minuteAt(event);
    if (!dispatchWithUndoToast({ type: "booking/move", id, date, start }, t("calendar.movedTo", { time: formatTime(start) }))) {
      showActionFailure("calendar.slotTaken");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-hairline">
      <div className="flex border-b border-hairline">
        <div className="w-11 shrink-0" />
        {staff.map((person) => (
          <div key={person.id} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-sm">
            <StaffDot staffId={person.id} />
            <span className="truncate font-medium">{person.firstName}</span>
            <span className="truncate text-xs text-text-secondary">
              {dayHeading(state, person.id, date, resourceId)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex py-3 pr-1">
        <TimeAxis from={from} to={to} pxPerMin={PX_PER_MIN} />
        {staff.map((person) => {
          const shift = workWindow(state, person.id, date);
          const works = shift !== null;
          return (
            <div
              key={person.id}
              onClick={works ? onColumnClick(person) : undefined}
              onDragOver={(event) => works && event.preventDefault()}
              onDrop={works ? onDrop(person) : undefined}
              className={cx("relative min-w-0 flex-1 border-l border-hairline", works ? "cursor-copy" : "bg-surface-2/70")}
              style={{ height }}
            >
              <HourLines from={from} to={to} pxPerMin={PX_PER_MIN} />
              {shift && shift.start > from && <div className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70" style={{ height: (shift.start - from) * PX_PER_MIN }} />}
              {shift && shift.end < to && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70" style={{ height: (to - shift.end) * PX_PER_MIN }} />}
              {lunch && works && (
                <div
                  className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--ui-border)_6px_7px)] text-[11px] text-text-secondary"
                  style={{ top: (lunch.start - from) * PX_PER_MIN, height: (lunch.end - lunch.start) * PX_PER_MIN }}
                >
                  {t("calendar.lunch")}
                </div>
              )}
              {dayBookings(state, date, person.id, resourceId).map((b) => (
                  <BookingBlock
                    key={b.id}
                    booking={b}
                    misfit={!shift || b.start < shift.start || b.start + b.duration > shift.end}
                    top={(b.start - from) * PX_PER_MIN + 1}
                    height={b.duration * PX_PER_MIN - 2}
                    onOpen={() => onOpen({ kind: "booking", id: b.id })}
                  />
                ))}
              {date === today && minutes > from && minutes < to && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: (minutes - from) * PX_PER_MIN }}>
                  <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-danger" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
