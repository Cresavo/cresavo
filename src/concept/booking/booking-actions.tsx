"use client";

import { customerText } from "../i18n/customer-text";

import { useState } from "react";
import { CalendarClock, CalendarPlus, Phone, XCircle } from "lucide-react";
import { deadlineText } from "./policy-summary";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import { findCustomer, findService, fullName } from "../selectors";
import { dispatchWithLog, withBookingLock } from "../store";
import { salonClock } from "../tools/clock";
import { Button, buttonClass } from "../ui/button";
import { Notice } from "../ui/notice";
import { Sheet } from "../ui/sheet";
import { showToast } from "../ui/toast";
import type { Now } from "../use-now";
import { buildIcs, googleCalendarLink, icsTimestamp } from "./ics";
import { FREE_CHANGE_HOURS, changeRule } from "./policy";
import { openSlots, type OpenSlot } from "./suggest";
import { TimePicker } from "./time-picker";
import { WaitlistSheet, type WaitlistRequest } from "./waitlist-sheet";

/** The deadline accepted for this visit. */
export function freeUntilText(booking: Booking): string {
  return deadlineText(booking, booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS);
}

function downloadCalendar(state: DemoState, booking: Booking) {
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find((s) => s.id === booking.staffId);
  if (!service || !staff) return;
  const ics = buildIcs({ booking, service, staff, salon: state.salon, language: state.localization.language, createdAt: icsTimestamp(new Date()) });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.salon.slug}-${booking.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Recheck the customer's original visit and its deadline under the booking lock. */
function canChangeBooking(latest: DemoState, booking: Booking) {
  const current = latest.bookings.find(b => b.id === booking.id);
  const instant = new Date();
  const clock = salonClock(instant);
  return !!current && current.date === booking.date && current.start === booking.start &&
    current.staffId === booking.staffId && changeRule(current, clock.today, clock.minutes, instant.getTime()) === "free";
}

interface BookingActionsProps {
  state: DemoState;
  now: Now;
  booking: Booking;
}

/** Add to calendar, reschedule and cancel. Inside the 24 h window the customer is asked to call. */
export function BookingActions({ state, now, booking }: BookingActionsProps) {
  const [sheet, setSheet] = useState<"move" | "cancel" | null>(null);
  const [pending, setPending] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistRequest | null>(null);
  const rule = changeRule(booking, now.today, now.minutes, now.instant);
  const service = findService(state, booking.serviceId);
  const customer = findCustomer(state, booking.customerId);
  if (rule === "past" || !service || !customer) return null;
  const notice = (kind: "reschedule" | "cancel", title: string, body: string) => ({
    kind,
    customerId: customer.id,
    bookingId: booking.id,
    date: now.today,
    time: now.minutes,
    title,
    body,
    read: false,
    handled: kind === "reschedule",
    draftReply: kind === "cancel" ? customerText(state, "booking.cancel.inboxReply", { name: customer.firstName }) : undefined,
  });
  const when = `${formatDayLong(booking.date)} ${formatTime(booking.start)}`;

  const cancel = async () => {
    if (pending) return;
    setPending(true);
    const result = await withBookingLock(() => dispatchWithLog({
      type: "booking/cancel",
      id: booking.id,
      reason: t("booking.cancel.reason"),
      notice: notice("cancel", t("booking.cancel.inboxTitle"), t("booking.cancel.inboxBody", { name: fullName(customer), service: service.name, when })),
    }, { actor: "customer", source: "customer-page" }, latest => canChangeBooking(latest, booking)));
    setPending(false);
    setSheet(null);
    showToast(t(result === false ? "booking.visitChanged" : "booking.cancel.done"));
  };

  const move = async (target: OpenSlot) => {
    if (pending) return;
    setPending(true);
    const result = await withBookingLock(() => dispatchWithLog({
      type: "booking/move",
      id: booking.id,
      date: target.date,
      start: target.start,
      staffId: target.staffId,
      notice: notice("reschedule", t("booking.move.inboxTitle"), t("booking.move.inboxBody", { name: fullName(customer), service: service.name, from: when, to: `${formatDayLong(target.date)} ${formatTime(target.start)}` })),
    }, undefined, latest => canChangeBooking(latest, booking) && openSlots(latest, service.id, target.date, salonClock(), {
      ignoreId: booking.id, staffId: target.staffId,
    }).some(slot => slot.start === target.start)));
    setPending(false);
    if (result !== false) setSheet(null);
    showToast(t(result === false ? "booking.slotTaken" : "booking.move.done"));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {rule === "free" && (
          <>
            <Button variant="secondary" icon={<CalendarClock size={16} />} onClick={() => setSheet("move")}>
              {t("booking.reschedule")}
            </Button>
            <Button variant="danger" icon={<XCircle size={16} />} onClick={() => setSheet("cancel")}>
              {t("booking.cancel")}
            </Button>
          </>
        )}
      </div>
      {rule === "late" && (
        <Notice tone="warning" className="flex items-start gap-2">
          <Phone size={16} className="mt-0.5 shrink-0" />
          <span>{t(state.salon.phone ? "booking.tooLate" : "booking.tooLateNoPhone", { hours: booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS, phone: state.salon.phone })}</span>
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={<CalendarPlus size={16} />} onClick={() => downloadCalendar(state, booking)}>
          {t("booking.calendarFile")}
        </Button>
        <a href={googleCalendarLink({ booking, service, salon: state.salon, language: state.localization.language })} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
          {t("booking.googleCalendar")}
        </a>
      </div>

      <Sheet
        open={rule === "free" && sheet === "cancel"}
        onClose={() => setSheet(null)}
        title={t("booking.cancel.title")}
        description={t("booking.cancel.text", { service: service.name, when })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheet(null)}>{t("booking.cancel.keep")}</Button>
            <Button variant="danger" disabled={pending} onClick={cancel}>{t("booking.cancel.confirm")}</Button>
          </>
        }
      >
        <p className="rounded-md bg-action-bg px-3.5 py-3 text-sm text-text">{freeUntilText(booking)}</p>
      </Sheet>

      <Sheet
        open={rule === "free" && sheet === "move"}
        onClose={() => setSheet(null)}
        title={t("booking.move.title")}
        description={t("booking.move.commitHint", { service: service.name, when })}
      >
        <div className="pt-3">
          <TimePicker
            state={state}
            serviceId={service.id}
            clock={now}
            ignoreId={booking.id}
            disabled={pending}
            onPick={move}
            onWaitlist={(date) => {
              setSheet(null);
              setWaitlist({ serviceId: service.id, date });
            }}
          />
        </div>
      </Sheet>
      {waitlist && <WaitlistSheet state={state} now={now} request={waitlist} onClose={() => setWaitlist(null)} />}
    </div>
  );
}
