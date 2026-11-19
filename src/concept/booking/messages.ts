import { formatTime } from "../data/dates";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDate } from "../i18n/format";
import { sendDemoMessage } from "../connections/demo";
import { bookingPage } from "./links";
import { findService } from "../selectors";

export type MessageChannel = "sms" | "email";
export type BookingMessageKind = "confirmation" | "reminder";
export interface BookingMessageAction {
  type: "booking-message/send";
  bookingId: string;
  channel: MessageChannel;
  kind: BookingMessageKind;
  at: { date: string; time: number };
}
export function messageSlot(booking: Booking) { return `${booking.date}:${booking.start}:${booking.staffId}`; }
export function bookingMessage(state: DemoState, booking: Booking, kind: BookingMessageKind) {
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find(staff => staff.id === booking.staffId);
  const subject = t(`messages.subject.${kind}`, { salon: state.salon.name });
  const details = t(`messages.body.${kind}`, {
    salon: state.salon.name, service: service?.name ?? "", date: formatDate(booking.date),
    time: formatTime(booking.start), staff: staff?.firstName ?? "", address: state.salon.address,
  });
  const path = bookingPage(state.salon.slug, booking.id);
  const body = t("messages.withManageLink", { details, link: path });
  return { subject, body, details, path };
}
export function messageWasSent(state: DemoState, booking: Booking, kind: BookingMessageKind, channel: MessageChannel) {
  return state.inbox.some(item => item.bookingId === booking.id && item.delivery?.kind === kind && item.delivery.channel === channel && item.delivery.slot === messageSlot(booking));
}
/** Sent through the SMS or email port with the simulated adapter; nothing leaves the demo. Repeated sends for the same booking/time are idempotent. */
export function sendBookingMessage(state: DemoState, action: BookingMessageAction): DemoState {
  const booking = state.bookings.find(booking => booking.id === action.bookingId);
  if (!booking || booking.status !== "booked" || booking.date < action.at.date ||
      (booking.date === action.at.date && booking.start <= action.at.time) ||
      !["sms", "email"].includes(action.channel) || !["confirmation", "reminder"].includes(action.kind) ||
      messageWasSent(state, booking, action.kind, action.channel)) return state;
  const message = bookingMessage(state, booking, action.kind);
  const sent = sendDemoMessage({ channel: action.channel, to: { customerId: booking.customerId }, subject: message.subject, body: message.body, reference: `${booking.id}-${action.kind}-${action.channel}-${messageSlot(booking)}` });
  if (!sent) return state;
  return {
    ...state, seq: state.seq + 1,
    inbox: [{
      id: `i-${state.seq}`, kind: "system", customerId: booking.customerId, bookingId: booking.id,
      date: action.at.date, time: action.at.time, title: t("messages.sentTitle", { channel: t(`messages.channel.${action.channel}`), subject: message.subject }),
      body: sent.body, read: false, handled: true,
      delivery: { kind: action.kind, channel: action.channel, slot: messageSlot(booking) },
    }, ...state.inbox],
  };
}
