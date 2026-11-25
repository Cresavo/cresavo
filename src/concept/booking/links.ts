// Customer-facing routes of one business, from its slug.

import type { GiftCard } from "../data/types";

export const bookingHome = (slug: string) => `/boka/${slug}`;
export const myBookings = (slug: string) => `${bookingHome(slug)}/me`;
export const widgetPath = (slug: string) => `${bookingHome(slug)}/widget`;
export const giftPage = (slug: string) => `${bookingHome(slug)}/gift`;

export const bookingPage = (slug: string, id: string) => `${bookingHome(slug)}/booking/${id}`;
export const myBookingsFor = (slug: string, customerId: string) => `${myBookings(slug)}?ref=${encodeURIComponent(customerId)}`;
export const rebookLink = (slug: string, serviceId: string, staffId?: string) =>
  `${bookingHome(slug)}?${new URLSearchParams({ service: serviceId, ...(staffId && { staff: staffId }) })}#book`;

/** A plain map search for the business's address (no embed, no third-party script); the map app finds the route and the time. */
export const mapLink = (address: string, area = "") =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent([address, area.split(" · ")[0]].filter(Boolean).join(", "))}`;

type SharedCard = Pick<GiftCard, "code" | "amount" | "recipient" | "message">;

/** The printable card as a link. It carries only what is printed on the card, never the balance: that is checked against the business's records. */
export const giftCardLink = (slug: string, card: SharedCard) =>
  `${giftPage(slug)}?${new URLSearchParams({ code: card.code, amount: String(card.amount), to: card.recipient, msg: card.message })}`;

/** The card a shared link describes, or null when it is not complete. */
export function giftCardFromParams(params: URLSearchParams): SharedCard | null {
  const code = params.get("code");
  const recipient = params.get("to");
  const amount = Number(params.get("amount"));
  if (!code || !recipient || !(amount > 0)) return null;
  return { code: code.slice(0, 32), amount, recipient: recipient.slice(0, 80), message: (params.get("msg") ?? "").slice(0, 280) };
}
