import { recordId } from "../data/ids";
import type { DemoState, Review } from "../data/types";
import { t } from "../i18n";

export type CustomerReviewAction =
  | { type: "review/submit"; bookingId: string; rating: number; text: string; at: { date: string; time: number } }
  | { type: "review/approve"; id: string };

export function applyCustomerReview(state: DemoState, action: CustomerReviewAction): DemoState {
  if (!state.modules.reviews) return state;
  if (action.type === "review/approve") {
    if (!state.reviews.some(review => review.id === action.id && review.approved === false)) return state;
    return {
      ...state,
      reviews: state.reviews.map(review => review.id === action.id ? { ...review, approved: true } : review),
      inbox: state.inbox.map(item => item.reviewId === action.id ? { ...item, read: true, handled: true } : item),
    };
  }
  const booking = state.bookings.find(booking => booking.id === action.bookingId);
  const text = action.text.trim();
  if (!booking || booking.status !== "completed" || booking.date > action.at.date ||
      (booking.date === action.at.date && booking.start + booking.duration > action.at.time) ||
      !Number.isInteger(action.rating) || action.rating < 1 || action.rating > 5 || !text || text.length > 2000 ||
      state.reviews.some(review => review.bookingId === booking.id)) return state;
  const review: Review = {
    id: recordId("r", state.seq), customerId: booking.customerId, bookingId: booking.id, staffId: booking.staffId,
    date: action.at.date, rating: action.rating as Review["rating"], text, source: "Booking page", approved: false,
  };
  return {
    ...state, seq: state.seq + 2, reviews: [review, ...state.reviews],
    inbox: [{ id: `i-${state.seq + 1}`, kind: "review", customerId: booking.customerId, bookingId: booking.id,
      reviewId: review.id, date: action.at.date, time: action.at.time, title: t("customerReview.inboxTitle"), body: text,
      read: false, handled: false,
    }, ...state.inbox],
  };
}
