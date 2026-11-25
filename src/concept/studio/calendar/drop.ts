"use client";

import type { DragEvent } from "react";
import type { DateKey, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDayLong, formatTime } from "../../i18n/format";
import { accountRecordSettled } from "../../store";
import { showActionFailure } from "../../ui/toast";
import { commitWithUndoToast } from "../log/commit-toast";
import { useStudio } from "../use-studio";
import { DRAG_TYPE } from "./block";

/** Whether a drag carries a booking, so a column only accepts what it can place. */
export function carriesBooking(event: DragEvent) {
  return event.dataTransfer.types.includes(DRAG_TYPE);
}

/**
 * Moves a dropped booking to `date` at `start` for the column's staff member. The reducer decides whether
 * the time is free; the calendar only reads where the booking was dropped. Same day says the new time,
 * another day says the day too, so the toast explains what changed.
 */
export function useBookingDrop() {
  const { state, target } = useStudio();
  return (event: DragEvent, staffId: StaffId, date: DateKey, start: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const booking = state.bookings.find((b) => b.id === id);
    // A booking a pending change made has only a provisional id until the server answers.
    if (!booking || !accountRecordSettled("bookings", id)) return;
    if (booking.staffId !== staffId) {
      const name = state.staff.find((s) => s.id === booking.staffId)!.firstName;
      showActionFailure("reference.sameStaffOnly", undefined, "studio", t("calendar.sameStaffOnly", { name }));
      return;
    }
    if (booking.date === date && booking.start === start) return;
    const time = formatTime(start);
    const otherDay = booking.date !== date;
    const message = otherDay ? t("calendar.movedToDay", { day: formatDayLong(date), time }) : t("calendar.movedTo", { time });
    const moved = target
      ? commitWithUndoToast(target, { type: "booking/move", id, date, start }, message).then((result) => result.ok, () => false)
      : Promise.resolve(false);
    void moved.then((ok) => {
      if (ok) return;
      if (otherDay) showActionFailure("calendar.slotTaken", undefined, "studio", t("calendar.dayNotFree", { day: formatDayLong(date), time }));
      else showActionFailure("calendar.slotTaken");
    });
  };
}
