"use client";

import { useState } from "react";
import type { Booking } from "../data/types";
import { formatTime } from "../data/dates";
import { t } from "../i18n";
import { formatDate } from "../i18n/format";
import { usePublicDemo } from "../store";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useNow } from "../use-now";
import { bookingPage } from "./links";
import { BookingWizard } from "./wizard";
import { findService } from "../selectors";

/** The entire booking stays inside the iframe; management opens a separate tab. */
export function BookingWidget() {
  const state = usePublicDemo();
  const now = useNow();
  const [bookedId, setBookedId] = useState<string>();
  const [repeat, setRepeat] = useState<Booking>();
  if (!state) return null;
  const booking = state.bookings.find(booking => booking.id === bookedId);
  return <div className="mx-auto max-w-2xl space-y-5">
    <div><h1 className="text-2xl font-semibold">{t("widget.title", { salon: state.salon.name })}</h1><p className="mt-1 text-sm text-text-secondary">{t("widget.help")}</p></div>
    {booking ? <Card className="space-y-4 p-5">
      <h2 className="text-xl font-semibold text-action">{t("booking.confirmation.title")}</h2>
      <p>{findService(state, booking.serviceId)?.name} · {formatDate(booking.date)} {formatTime(booking.start)}</p>
      <a className="block font-medium text-action underline" href={bookingPage(state.salon.slug, booking.id)} target="_blank" rel="noopener noreferrer">{t("widget.manage")}</a>
      <Button variant="secondary" onClick={() => { setRepeat(booking); setBookedId(undefined); }}>{t("booking.me.rebook")}</Button>
    </Card> : <BookingWizard state={state} now={now} initialServiceId={repeat?.serviceId} initialStaffId={repeat?.staffId} onBooked={setBookedId} />}
  </div>;
}
