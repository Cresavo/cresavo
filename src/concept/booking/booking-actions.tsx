"use client";

import { customerText } from "../i18n/customer-text";

import { useState } from "react";
import { CalendarClock, CalendarPlus, Navigation, XCircle } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import { findCustomer, findService, fullName } from "../selectors";
import { currentState, targetOf } from "../store";
import { commitAction } from "../store/commit";
import { newActionRequestId } from "../support/action-reference";
import { salonClock } from "../tools/clock";
import { Button, buttonClass } from "../ui/button";
import { ActionFailure, type ActionFailureInfo } from "../ui/action-failure";
import { Notice } from "../ui/notice";
import { Sheet } from "../ui/sheet";
import { showActionFailure, showToast } from "../ui/toast";
import type { Now } from "../use-now";
import { useCommit } from "../ui/use-commit";
import { buildIcs, googleCalendarLink, icsTimestamp } from "./ics";
import { FREE_CHANGE_HOURS, changeRule } from "./policy";
import { freeUntilText } from "./deadline-text";
import { mapLink } from "./links";
import { openSlots, type OpenSlot } from "./suggest";
import { TimePicker } from "./time-picker";
import { WaitlistSheet, type WaitlistRequest } from "./waitlist-sheet";

const CUSTOMER_PAGE = { actor: "customer", source: "customer-page" } as const;

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

/**
 * Save the visit and find the way: the calendar file is the main action, with directions beside it.
 * The map app works out the route and the travel time; the page never guesses one.
 */
export function CalendarActions({ state, booking }: { state: DemoState; booking: Booking }) {
  const service = findService(state, booking.serviceId);
  if (!service) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button icon={<CalendarPlus size={16} />} onClick={() => downloadCalendar(state, booking)}>
        {t("booking.calendarFile")}
      </Button>
      <a href={mapLink(state.salon.address, state.salon.area)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
        <Navigation aria-hidden size={16} />
        {t("booking.directions")}
      </a>
      <a href={googleCalendarLink({ booking, service, salon: state.salon, language: state.localization.language })} target="_blank" rel="noopener noreferrer" className={buttonClass("link")}>
        {t("booking.googleCalendar")}
      </a>
    </div>
  );
}

/** Reschedule and cancel. Inside the 24 h window the customer is asked to call. */
export function BookingActions({ state, now, booking }: BookingActionsProps) {
  const [sheet, setSheet] = useState<"move" | "cancel" | null>(null);
  const [run, pending] = useCommit();
  const [moveFailure, setMoveFailure] = useState<ActionFailureInfo>();
  const [waitlist, setWaitlist] = useState<WaitlistRequest | null>(null);
  const rule = changeRule(booking, now.today, now.minutes, now.instant);
  const moveOpen = rule === "free" && sheet === "move";
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

  // The salon this page shows: a change is refused once that salon was replaced.
  const salon = targetOf(state);
  const commit = (action: Parameters<typeof commitAction>[1], guard: (latest: DemoState) => boolean) =>
    salon ? commitAction(salon, action, { meta: CUSTOMER_PAGE, guard }).then((result) => result.ok, () => false) : Promise.resolve(false);

  const cancel = () => run(async () => {
    const requestId = newActionRequestId();
    const done = await commit({
      type: "booking/cancel",
      id: booking.id,
      reason: t("booking.cancel.reason"),
      notice: notice("cancel", t("booking.cancel.inboxTitle"), t("booking.cancel.inboxBody", { name: fullName(customer), service: service.name, when })),
    }, latest => canChangeBooking(latest, booking));
    setSheet(null);
    if (!done) showActionFailure("booking.visitChanged", requestId, "booking");
    else showToast(t("booking.cancel.done"));
  });

  const move = (target: OpenSlot) => run(async () => {
    const requestId = newActionRequestId();
    setMoveFailure(undefined);
    const done = await commit({
      type: "booking/move",
      id: booking.id,
      date: target.date,
      start: target.start,
      staffId: target.staffId,
      notice: notice("reschedule", t("booking.move.inboxTitle"), t("booking.move.inboxBody", { name: fullName(customer), service: service.name, from: when, to: `${formatDayLong(target.date)} ${formatTime(target.start)}` })),
    }, latest => canChangeBooking(latest, booking) && openSlots(latest, service.id, target.date, salonClock(), {
      ignoreId: booking.id, staffId: target.staffId,
    }).some(slot => slot.start === target.start));
    if (!done) {
      const reason = "booking.move.failed";
      const latest = currentState()?.bookings.find(entry => entry.id === booking.id);
      const clock = salonClock();
      if (!latest || changeRule(latest, clock.today, clock.minutes) === "past") showActionFailure(reason, requestId, "booking");
      else setMoveFailure({ requestId, reason });
      return;
    }
    setSheet(null);
    showToast(t("booking.move.done"));
  });

  // Two visits of the same treatment can be for different people: the dialog says whose this one is.
  const withVisitor = (text: string) => (booking.visitFor ? `${t("booking.for.visit", { name: booking.visitFor })}. ${text}` : text);

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
        <Notice tone="warning">
          {t(state.salon.phone ? "booking.tooLate" : "booking.tooLateNoPhone", { hours: booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS, phone: state.salon.phone })}
        </Notice>
      )}
      {!moveOpen && moveFailure && <ActionFailure failure={moveFailure} audience="booking" />}

      <Sheet
        open={rule === "free" && sheet === "cancel"}
        onClose={() => setSheet(null)}
        title={t("booking.cancel.title")}
        description={withVisitor(t("booking.cancel.text", { service: service.name, when }))}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheet(null)}>{t("booking.cancel.keep")}</Button>
            <Button variant="danger" disabled={pending} onClick={cancel}>{t("booking.cancel.confirm")}</Button>
          </>
        }
      >
        <p className="rounded-md bg-action-bg px-4 py-3 text-meta text-text">{freeUntilText(booking)}</p>
      </Sheet>

      <Sheet
        open={moveOpen}
        onClose={() => setSheet(null)}
        title={t("booking.move.title")}
        description={withVisitor(t("booking.move.commitHint", { service: service.name, when }))}
      >
        <div className="space-y-3 pt-3">
          {moveFailure && <ActionFailure failure={moveFailure} audience="booking" />}
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
