"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t, tc } from "../i18n";
import { dispatch } from "../store";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";
import { Field, Input, TextArea } from "../ui/controls";
import type { Now } from "../use-now";

export function canWriteReview(state: DemoState, booking: Booking) {
  return booking.status === "completed" && state.modules.reviews && !state.reviews.some(review => review.bookingId === booking.id);
}

export function ReviewForm({ state, booking, now, variant = "secondary" }: {
  state: DemoState; booking: Booking; now: Now; variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  if (booking.status !== "completed" || !state.modules.reviews) return null;
  const existing = state.reviews.find(review => review.bookingId === booking.id);
  if (existing) return <p role="status" className="mt-3">
    {existing.approved === false
      ? <Badge icon={Clock}>{t("customerReview.pending")}</Badge>
      : <Badge tone="accent">{t("customerReview.approved")}</Badge>}
  </p>;
  if (!open) return <Button className="mt-3" variant={variant} size="sm" onClick={() => setOpen(true)}>{t("customerReview.open")}</Button>;
  return (
    <form className="mt-4 space-y-4 border-t border-hairline pt-4" onSubmit={event => {
      event.preventDefault();
      setFailed(!dispatch({ type: "review/submit", bookingId: booking.id, rating, text, at: { date: now.today, time: now.minutes } }));
    }}>
      <h2 className="font-semibold">{t("customerReview.title")}</h2>
      <fieldset>
        <legend className="mb-2 text-meta font-medium">{t("customerReview.rating")}</legend>
        <div className="flex flex-wrap gap-1">{[1, 2, 3, 4, 5].map(stars => <label key={stars} className="cursor-pointer">
          <Input className="peer sr-only" type="radio" name={`rating-${booking.id}`} value={stars} checked={rating === stars} onChange={() => setRating(stars)} aria-label={tc("customerReview.stars", stars)} />
          <span className="flex size-target items-center justify-center rounded-md border border-input-border text-h2 text-text peer-checked:bg-action-bg peer-checked:ring-2 peer-checked:ring-action peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus" aria-hidden>{stars <= rating ? "★" : "☆"}</span>
        </label>)}</div>
      </fieldset>
      <Field label={t("customerReview.text")}><TextArea aria-label={t("customerReview.text")} value={text} maxLength={2000} required onChange={event => setText(event.target.value)} /></Field>
      <p className="text-meta text-text-secondary">{t("customerReview.help")}</p>
      {failed && <Notice tone="danger" role="alert">{t("customerReview.failed")}</Notice>}
      <Button type="submit" variant={variant} disabled={!rating || !text.trim()}>{t("customerReview.submit")}</Button>
    </form>
  );
}
