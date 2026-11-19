import type { InboxItem, Review } from "../../data/types";
import { t } from "../../i18n";

/** Older reviews have no saved Inbox message. Give them a row without changing stored data. */
export function reviewInboxItems(reviews: Review[], inbox: InboxItem[]): InboxItem[] {
  const notices = inbox.filter((item) => item.kind === "review");
  const linked = new Set(notices.map((item) => item.reviewId));
  const older = reviews.filter((review) => !linked.has(review.id)).map((review): InboxItem => ({
    id: `review:${review.id}`,
    kind: "review",
    reviewId: review.id,
    customerId: review.customerId,
    bookingId: review.bookingId,
    date: review.date,
    time: 0,
    title: t(review.approved === false ? "customerReview.inboxTitle" : "inbox.kind.review"),
    body: review.text,
    read: true,
    handled: !!review.reply,
  }));
  return [...notices, ...older].sort((a, b) => b.date.localeCompare(a.date) || b.time - a.time);
}
