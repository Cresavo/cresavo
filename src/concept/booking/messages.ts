import { sendDemoMessage } from "../connections/demo";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { customerText } from "../i18n/customer-text";
import { formatDate, formatTime } from "../i18n/format";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { findService } from "../selectors";
import { bookingPage } from "./links";

export type MessageChannel = "sms" | "email";
/** Confirmation and reminder go out on the salon's request; cancellation and moved confirm what the customer did from their booking link. */
export type BookingMessageKind = "confirmation" | "reminder" | "cancellation" | "moved";
export interface BookingMessageAction {
  type: "booking-message/send";
  bookingId: string;
  channel: MessageChannel;
  kind: BookingMessageKind;
  at: { date: string; time: number };
  /** Tells one send of the same message to the same time from another, for a visit moved away and back. */
  occasion?: number;
}
export function messageSlot(booking: Booking, occasion?: number) { return `${booking.date}:${booking.start}:${booking.staffId}${occasion === undefined ? "" : `#${occasion}`}`; }
/** The stable id of one logical send, kept on the outbox entry so a delivery can tell which booking and message it is for. */
export function messageReference(booking: Booking, kind: BookingMessageKind, channel: MessageChannel, occasion?: number) { return `${booking.id}-${kind}-${channel}-${messageSlot(booking, occasion)}`; }
/** Which booking and message a reference names, and the slot it was sent for: what a change agreed to, kept even if the booking has moved on by the time it is delivered. */
export function parseMessageReference(reference: string): { bookingId: string; kind: BookingMessageKind; slot: { date: string; start: number; staffId: string } } | undefined {
  const match = /^(.+)-(confirmation|reminder|cancellation|moved)-(?:sms|email)-(\d{4}-\d{2}-\d{2}):(\d+):(.+?)(?:#\d+)?$/.exec(reference);
  return match ? { bookingId: match[1], kind: match[2] as BookingMessageKind, slot: { date: match[3], start: Number(match[4]), staffId: match[5] } } : undefined;
}
export function bookingMessage(state: DemoState, booking: Booking, kind: BookingMessageKind) {
  const { language } = state.localization;
  const stored = findService(state, booking.serviceId);
  const service = stored && serviceCopy(stored, language);
  const staff = state.staff.find(staff => staff.id === booking.staffId);
  const subject = customerText(state, `messages.subject.${kind}`, { salon: state.salon.name });
  const visit = customerText(state, state.salon.address ? `messages.body.${kind}` : `messages.noAddress.${kind}`, {
    salon: state.salon.name, service: service?.name ?? "", date: formatDate(booking.date, language),
    time: formatTime(booking.start, language), staff: staff?.firstName ?? "", address: state.salon.address,
  });
  // The message goes to the customer who booked; it says who the visit is for when that is someone else.
  const details = booking.visitFor ? `${visit} ${customerText(state, "messages.forGuest", { name: booking.visitFor })}` : visit;
  const path = bookingPage(state.salon.slug, booking.id);
  const body = customerText(state, "messages.withManageLink", { details, link: path });
  return { subject, body, details, path };
}
export function messageWasSent(state: DemoState, booking: Booking, kind: BookingMessageKind, channel: MessageChannel, occasion?: number) {
  return state.inbox.some(item => item.bookingId === booking.id && item.delivery?.kind === kind && item.delivery.channel === channel && item.delivery.slot === messageSlot(booking, occasion));
}
/** Sent through the SMS or email port with the simulated adapter; nothing leaves the demo. Repeated sends for the same booking/time are idempotent. */
export function sendBookingMessage(state: DemoState, action: BookingMessageAction): DemoState {
  const booking = state.bookings.find(booking => booking.id === action.bookingId);
  // A cancellation is the one message about a booking that is no longer booked.
  if (!booking || booking.status !== (action.kind === "cancellation" ? "cancelled" : "booked") || booking.date < action.at.date ||
      (booking.date === action.at.date && booking.start <= action.at.time) ||
      !["sms", "email"].includes(action.channel) || !["confirmation", "reminder", "cancellation", "moved"].includes(action.kind) ||
      messageWasSent(state, booking, action.kind, action.channel, action.occasion)) return state;
  const message = bookingMessage(state, booking, action.kind);
  const sent = sendDemoMessage({ channel: action.channel, to: { customerId: booking.customerId }, subject: message.subject, body: message.body, reference: messageReference(booking, action.kind, action.channel, action.occasion) });
  if (!sent) return state;
  return {
    ...state, seq: state.seq + 1,
    inbox: [{
      id: `i-${state.seq}`, kind: "system", customerId: booking.customerId, bookingId: booking.id,
      date: action.at.date, time: action.at.time, title: t("messages.sentTitle", { channel: t(`messages.channel.${action.channel}`), subject: message.subject }),
      body: sent.body, read: false, handled: true,
      delivery: { kind: action.kind, channel: action.channel, slot: messageSlot(booking, action.occasion) },
    }, ...state.inbox],
  };
}
