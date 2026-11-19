import { toMinutes } from "../data/dates";
import { openingFor, staffWorks, workWindow } from "../data/slots";
import type { Booking, DateKey, DemoState, StaffId } from "../data/types";
import { t, tc } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import type { IntentParams } from "../intent";
import { holidayOn } from "../ops/holidays";
import type { Clock, Proposal } from "./proposal";

// Proposals for changes to the plan. They say how many bookings would no
// longer fit, so the owner knows what "needs moving" afterwards.

const message = (text: string): Proposal => ({ kind: "message", text });

function upcoming(state: DemoState, date: DateKey, staffId?: StaffId): Booking[] {
  return state.bookings.filter((b) => b.status === "booked" && b.date === date && (!staffId || b.staffId === staffId));
}

const affectedRow = (count: number) => ({
  label: t("command.row.bookings"),
  after: count ? tc("command.affected", count) : t("command.affectedNone"),
});

export function staffOffProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const staff = state.staff.find((s) => s.id === params.staffId);
  const date = params.date;
  if (!staff || !date) return message(t("command.notUnderstood"));
  if (date < clock.today) return message(t("command.dayPassed", { day: formatDayLong(date) }));
  if (!staffWorks(state, staff.id, date)) return message(t("command.off.already", { name: staff.firstName, day: formatDayLong(date) }));
  return {
    kind: "change",
    title: t("command.off.title", { name: staff.firstName, day: formatDayLong(date) }),
    subtitle: t(`command.reason.${params.reason ?? "other"}`),
    rows: [
      { label: t("command.row.when"), before: t("command.off.works"), after: t("command.off.off") },
      affectedRow(upcoming(state, date, staff.id).length),
    ],
    action: { type: "staff/off", staffId: staff.id, dates: [date], reason: params.reason ?? "other" },
    toast: t("command.off.toast", { name: staff.firstName, day: formatDayLong(date) }),
  };
}

export function closeSalonProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const date = params.date;
  if (!date) return message(t("command.notUnderstood"));
  if (date < clock.today) return message(t("command.dayPassed", { day: formatDayLong(date) }));
  if (!openingFor(state.salon, date)) return message(t("command.close.already", { day: formatDayLong(date) }));
  const holiday = holidayOn(date);
  return {
    kind: "change",
    title: t("command.close.title", { day: formatDayLong(date) }),
    subtitle: holiday ? t(holiday.name) : undefined,
    rows: [
      { label: t("command.row.when"), before: t("calendar.open"), after: t("calendar.closed") },
      affectedRow(upcoming(state, date).length),
    ],
    action: { type: "salon/close", date, name: holiday ? t(holiday.name) : t("ops.closure.default") },
    toast: t("command.close.toast", { day: formatDayLong(date) }),
    destructive: true,
  };
}

export function shiftProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const staff = state.staff.find((s) => s.id === params.staffId);
  const date = params.date;
  if (!staff || !date || !params.time || !params.endTime) return message(t("command.notUnderstood"));
  if (date < clock.today) return message(t("command.dayPassed", { day: formatDayLong(date) }));
  const hours = openingFor(state.salon, date);
  if (!hours) return message(t("command.close.already", { day: formatDayLong(date) }));
  const start = toMinutes(params.time);
  const end = toMinutes(params.endTime);
  if (start < hours.open || end > hours.close) {
    return message(t("command.shift.outside", { day: formatDayLong(date), from: formatTime(hours.open), to: formatTime(hours.close) }));
  }
  const current = workWindow(state, staff.id, date);
  const outside = upcoming(state, date, staff.id).filter((b) => b.start < start || b.start + b.duration > end).length;
  return {
    kind: "change",
    title: t("command.shift.title", { name: staff.firstName, day: formatDayLong(date) }),
    rows: [
      { label: t("command.row.hours"), before: current ? `${formatTime(current.start)}–${formatTime(current.end)}` : t("command.off.off"), after: `${formatTime(start)}–${formatTime(end)}` },
      ...(outside ? [affectedRow(outside)] : []),
    ],
    action: { type: "staff/shift", staffId: staff.id, date, start, end },
    toast: t("command.shift.toast", { name: staff.firstName, day: formatDayLong(date) }),
  };
}
