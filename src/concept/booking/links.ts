// Customer-facing routes. The salon slug is fixed for the demo.

import type { GiftCard } from "../data/types";

export const BOOKING_HOME = "/boka/salong-eko";
export const MY_BOOKINGS = `${BOOKING_HOME}/me`;

export const bookingPage = (id: string) => `${BOOKING_HOME}/booking/${id}`;
export const myBookingsFor = (customerId: string) => `${MY_BOOKINGS}?ref=${encodeURIComponent(customerId)}`;
export const rebookLink = (serviceId: string) => `${BOOKING_HOME}?service=${encodeURIComponent(serviceId)}#book`;

export const GIFT_PAGE = `${BOOKING_HOME}/gift`;

type SharedCard = Pick<GiftCard, "code" | "amount" | "recipient" | "message">;

/** The printable card as a link. It carries only what is printed on the card, never the balance: that is checked against the business's records. */
export const giftCardLink = (card: SharedCard) =>
  `${GIFT_PAGE}?${new URLSearchParams({ code: card.code, amount: String(card.amount), to: card.recipient, msg: card.message })}`;

/** The card a shared link describes, or null when it is not complete. */
export function giftCardFromParams(params: URLSearchParams): SharedCard | null {
  const code = params.get("code");
  const recipient = params.get("to");
  const amount = Number(params.get("amount"));
  if (!code || !recipient || !(amount > 0)) return null;
  return { code: code.slice(0, 32), amount, recipient: recipient.slice(0, 80), message: (params.get("msg") ?? "").slice(0, 280) };
}
