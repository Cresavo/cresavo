import { randomUUID } from "node:crypto";
import type { DemoAction } from "../actions";
import { addDays, formatTime, toMinutes } from "../data/dates";
import type { StaffBlock } from "../data/types";
import { canBlock, freeStarts, needOf } from "../data/slots";
import { t } from "../i18n";
import { finishedVisit, fullName } from "../selectors";
import { salonClock } from "../tools/clock";
import type { ChangeDraft } from "../tools/define";
import { proposeCancel } from "../tools/write";
import { bookingById, buildMove, type Move } from "./appointments";
import type { PairState } from "./fixture";
import { requirePair } from "./http";
import { BOOKING_MOVE_SCOPES, BOOKING_PROPOSAL_SCOPE, type ToolScope } from "./policy";
import { customerById, serviceById, staffByRef } from "./reads";

export const fictionalNames = ["Alex Birch", "Robin Vale", "Sam Linden"] as const;
export const cancelReasons = ["customer_request", "schedule_change", "duplicate"] as const;
export const blockReasons = ["break", "training", "admin"] as const satisfies readonly StaffBlock["reason"][];
export const replyTemplates = ["acknowledge", "follow_up"] as const;

export type ProposalInput = Move |
  { kind: "book"; serviceId: string; staffId: string; date: string; time: string; customerId?: string; newCustomerName?: typeof fictionalNames[number] } |
  { kind: "cancel"; bookingId: string; reason: typeof cancelReasons[number] } |
  { kind: "block"; staffId: string; date: string; from: string; to: string; reason: StaffBlock["reason"] } |
  { kind: "reply"; itemId: string; template?: typeof replyTemplates[number]; replyText?: string } |
  { kind: "price"; serviceId: string; newPrice: number } |
  { kind: "visibility"; serviceId: string; visible: boolean };

const money = (sek: number) => t("pair.priceSek", { amount: sek.toFixed(2) });
function draft(action: DemoAction, title: string, rows: ChangeDraft["rows"]): ChangeDraft {
  return { action, title, rows, toast: t("pair.applied") };
}
function upcoming(date: string, start: number) {
  const { today, minutes } = salonClock();
  requirePair(date >= today && date <= addDays(today, 90) && (date !== today || start >= minutes), "choose_upcoming_date");
}
function cancellableBooking(state: PairState, id: string, { today, minutes }: ReturnType<typeof salonClock>) {
  const booking = bookingById(state, id);
  requirePair(booking.status === "booked" && !finishedVisit(booking, today, minutes), "booking_unavailable", 409);
  return booking;
}
export function buildDraft(state: PairState, input: ProposalInput): ChangeDraft {
  if (!("kind" in input)) return buildMove(state, input);
  switch (input.kind) {
    case "book": {
      const service = serviceById(state, input.serviceId);
      const staff = staffByRef(state, input.staffId);
      const start = toMinutes(input.time);
      upcoming(input.date, start);
      requirePair(!service.hidden && service.staffIds.includes(staff.id) &&
        freeStarts(state, staff.id, input.date, needOf(service)).includes(start), "slot_unavailable", 409);
      requirePair(Boolean(input.customerId) !== Boolean(input.newCustomerName), "choose_customer");
      const customer = input.customerId ? customerById(state, input.customerId) : undefined;
      const name = customer ? fullName(customer) : input.newCustomerName!;
      const guest = customer ? { customerId: customer.id } : { fictionalCustomer: { id: randomUUID(), name, since: salonClock().today } };
      return draft({ type: "booking/create", id: randomUUID(), serviceId: service.id, staffId: staff.id,
        date: input.date, start, source: "assistant", ...guest }, t("command.book.title", { name, service: service.name }), [
        { label: t("command.row.when"), before: t("command.free"), after: `${input.date} ${input.time}` },
        { label: t("command.row.with"), after: staff.firstName }, { label: t("command.row.price"), after: money(service.price) },
      ]);
    }
    case "cancel": {
      const clock = salonClock();
      const booking = cancellableBooking(state, input.bookingId, clock);
      const change = proposeCancel.draft({ state, clock }, { bookingId: booking.id });
      const reason = t(`pair.reason.${input.reason}`);
      return draft({ type: "booking/cancel", id: booking.id, reason }, change.title, [...change.rows, { label: t("pair.reason"), after: reason }]);
    }
    case "block": {
      const staff = staffByRef(state, input.staffId);
      const start = toMinutes(input.from), end = toMinutes(input.to);
      upcoming(input.date, start);
      requirePair(canBlock(state, staff.id, input.date, start, end), "block_unavailable", 409);
      const reason = t(`pair.reason.${input.reason}`);
      return draft({ type: "staff/block", date: input.date, staffId: staff.id, start, end, reason: input.reason }, t("pair.block", { staff: staff.firstName }), [
        { label: `${input.date} ${input.from}–${input.to}`, before: t("command.free"), after: reason },
      ]);
    }
    case "reply": {
      const item = state.inbox.find(i => i.id === input.itemId);
      requirePair(item, "item_not_found", 404);
      requirePair(!item.handled, "item_handled", 409);
      requirePair(Boolean(input.template) !== Boolean(input.replyText), "choose_reply");
      const reply = input.template ? t(`pair.template.${input.template}`) : input.replyText!;
      return draft({ type: "inbox/reply", id: item.id, reply }, t("pair.replyTo", { title: item.title }), [
        { label: t("pair.assistantByline"), before: t("pair.noReply"), after: reply },
        { label: t("pair.delivery"), after: t("pair.simulated") },
      ]);
    }
    case "price": {
      const service = serviceById(state, input.serviceId);
      const price = input.newPrice / 100;
      requirePair(price !== service.price, "unchanged", 409);
      return draft({ type: "service/price", id: service.id, price }, t("pair.price", { service: service.name }), [
        { label: t("pair.futurePrice"), before: money(service.price), after: money(price) },
      ]);
    }
    case "visibility": {
      const service = serviceById(state, input.serviceId);
      requirePair(input.visible === !!service.hidden, "unchanged", 409);
      return draft({ type: "service/visibility", id: service.id, hidden: !input.visible }, t("pair.availability", { service: service.name }), [
        { label: t("pair.pairedCatalogue"), before: t(input.visible ? "pair.hidden" : "pair.visible"), after: t(input.visible ? "pair.visible" : "pair.hidden") },
      ]);
    }
  }
}

export function proposalScope(type: DemoAction["type"]): ToolScope {
  if (type === "service/price" || type === "service/visibility") return "catalog:propose";
  if (type === "inbox/reply") return "inbox:propose";
  if (type === "booking/move") return BOOKING_MOVE_SCOPES;
  return BOOKING_PROPOSAL_SCOPE;
}

export function revalidate(state: PairState, action: DemoAction) {
  if (action.type === "booking/move") buildMove(state, { bookingId: action.id, date: action.date, time: formatTime(action.start) });
  if (action.type === "booking/create" || action.type === "staff/block") upcoming(action.date, action.start);
  if (action.type === "booking/create") requirePair(!serviceById(state, action.serviceId).hidden, "slot_unavailable");
  if (action.type === "booking/cancel") cancellableBooking(state, action.id, salonClock());
  if (action.type === "inbox/reply") requirePair(state.inbox.some(i => i.id === action.id && !i.handled), "item_handled");
}
