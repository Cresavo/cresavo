import { recordId } from "../data/ids";
import { majorString } from "../connections/core";
import type { Booking, DateKey, DemoState, GiftCard } from "../data/types";

// Gift cards are prepaid, so selling one is not revenue: the money is owed to
// the customer (a liability) until they spend it. It becomes revenue through
// the booking it pays for, which counts when that visit is done like any other
// visit. A card's balance is derived from its redemptions, so cancelling or
// undoing a booking gives the money back without extra bookkeeping.

export const MIN_AMOUNT = 100;
export const MAX_AMOUNT = 10000;

/** No 0/O/1/I: codes are read aloud and typed from a printed card. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A readable code such as "EKO-7K2Q-93XD", derived from the running number so the reducer stays pure. */
export function giftCardCode(prefix: string, seq: number): string {
  let n = (seq * 2654435761 + 40503) >>> 0;
  let chars = "";
  for (let i = 0; i < 8; i++) {
    n = (Math.imul(n, 1103515245) + 12345) >>> 0;
    chars += ALPHABET[(n >>> 16) % ALPHABET.length];
  }
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Upper case without spaces or dashes, so "eko 7k2q-93xd" finds "EKO-7K2Q-93XD". */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function findGiftCard(state: DemoState, code: string): GiftCard | undefined {
  const wanted = normalizeCode(code);
  return wanted ? state.giftCards.find((card) => normalizeCode(card.code) === wanted) : undefined;
}

/** A final fee decision or deposit refund permanently returns gift-card credit. */
export function returnRedemptions(cards: GiftCard[], bookingIds: ReadonlySet<string>): GiftCard[] {
  return cards.map(card => card.redemptions.some(r => !r.returned && bookingIds.has(r.bookingId))
    ? { ...card, redemptions: card.redemptions.map(r => bookingIds.has(r.bookingId) ? { ...r, returned: true } : r) }
    : card);
}

/** What the card paid for bookings that still stand. */
export function usedAmount(state: DemoState, card: GiftCard): number {
  const cancelled = new Set(state.bookings.filter((b) => b.status === "cancelled").map((b) => b.id));
  return card.redemptions.filter((r) => !r.returned && !cancelled.has(r.bookingId)).reduce((sum, r) => sum + r.amount, 0);
}

export const balanceOf = (state: DemoState, card: GiftCard) => card.amount - usedAmount(state, card);

/**
 * False when a card would pay more than it holds. That happens if a cancelled
 * booking comes back (restore or undo) after its refunded balance was spent.
 */
export const cardsCovered = (state: DemoState) => state.giftCards.every((card) => balanceOf(state, card) >= 0);

/** What all gift cards still hold: money the business owes its customers. */
export function giftCardLiability(state: DemoState): number {
  return state.giftCards.reduce((sum, card) => sum + balanceOf(state, card), 0);
}

/** What a booking has already been paid with gift cards. */
export function paidWithCards(state: DemoState, bookingId: string): number {
  return state.giftCards.reduce((sum, card) => sum + card.redemptions.filter((r) => !r.returned && r.bookingId === bookingId).reduce((s, r) => s + r.amount, 0), 0);
}

export function remainingForCards(state: DemoState, booking: Booking) {
  const protection = booking.protection;
  const deposit = protection?.deposit ? Number(majorString({ amountMinor: protection.terms.depositMinor, currency: protection.terms.currency })) : 0;
  return Math.max(0, booking.price - deposit - paidWithCards(state, booking.id));
}

/** A gift card can cover the remaining balance after other payments. */
export function redeemable(state: DemoState, card: GiftCard, booking: Booking | undefined): number {
  if (!booking || booking.status !== "booked") return 0;
  return Math.min(balanceOf(state, card), remainingForCards(state, booking));
}

/** Codes start with the business's initials, e.g. "EKO" for Salong Eko. */
function codePrefix(state: DemoState): string {
  const word = state.salon.name.split(/\s+/).at(-1) ?? "";
  return word.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "GIFT";
}

/** Sells a card. The amount is rounded to whole kronor and must be within limits. */
export function sellGiftCard(
  state: DemoState,
  input: { amount: number; recipient: string; message: string; date: DateKey },
): DemoState {
  const amount = Math.round(input.amount);
  const recipient = input.recipient.trim();
  if (!(amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) || !recipient) return state;
  let seq = state.seq;
  let code = giftCardCode(codePrefix(state), seq);
  while (findGiftCard(state, code)) code = giftCardCode(codePrefix(state), ++seq);
  const card: GiftCard = { id: recordId("g", state.seq), code, amount, recipient, message: input.message.trim(), soldOn: input.date, redemptions: [] };
  return { ...state, seq: state.seq + 1, giftCards: [...state.giftCards, card] };
}

/** Pays (part of) a booking with the card. */
export function redeemGiftCard(state: DemoState, input: { code: string; bookingId: string; date: DateKey }): DemoState {
  const card = findGiftCard(state, input.code);
  if (!card) return state;
  const amount = redeemable(state, card, state.bookings.find((b) => b.id === input.bookingId));
  if (amount <= 0) return state;
  const redemptions = [...card.redemptions, { bookingId: input.bookingId, amount, date: input.date }];
  return { ...state, giftCards: state.giftCards.map((c) => (c.id === card.id ? { ...c, redemptions } : c)) };
}
