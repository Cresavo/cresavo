"use client";

import Link from "next/link";
import { CalendarCheck, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { formatTime } from "../data/dates";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney } from "../i18n/format";
import { useDemo } from "../store";
import { Avatar } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { useNow } from "../use-now";
import { BookingActions, freeUntilText } from "./booking-actions";
import { changeRule } from "./policy";
import { bookingHome, myBookingsFor, rebookLink } from "./links";
import { MessagePreviews } from "./message-previews";
import { ReviewForm } from "./review-form";

/** What the customer sees after booking, and the page behind the link in their confirmation. */
export function Confirmation({ id }: { id: string }) {
  const state = useDemo();
  const now = useNow();
  const booking = state?.bookings.find((b) => b.id === id);
  const service = state?.services.find((s) => s.id === booking?.serviceId);
  const person = state?.staff.find((s) => s.id === booking?.staffId);
  if (!state || !booking || !service || !person) {
    return (
      <Card className="mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-lg font-semibold">{t("booking.notFound.title")}</p>
        <p className="text-text-secondary">{t("booking.notFound.text")}</p>
        <ButtonLink href={bookingHome(state?.salon.slug ?? "")}>{t("booking.notFound.action")}</ButtonLink>
      </Card>
    );
  }

  const cancelled = booking.status === "cancelled";
  const active = changeRule(booking, now.today, now.minutes) !== "past";
  const Icon = cancelled ? XCircle : CheckCircle2;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="space-y-2 text-center">
        {cancelled ? (
          <span data-tone="danger" className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-bg text-danger">
            <Icon size={36} />
          </span>
        ) : (
          <Icon size={44} className="mx-auto text-action" />
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{cancelled ? t("booking.confirmation.cancelled") : t("booking.confirmation.title")}</h1>
        <p className="text-text-secondary">{cancelled ? t("booking.confirmation.cancelledText") : t("booking.confirmation.text")}</p>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <p className="text-lg font-semibold">{service.name}</p>
          <p className="mt-1 flex items-center gap-2 text-[15px]">
            <CalendarCheck size={16} className="shrink-0 text-action" />
            {formatDayLong(booking.date)}, {formatTime(booking.start)}–{formatTime(booking.start + booking.duration)}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Avatar name={person.firstName} size="sm" />
          <span>{t("booking.withStaff", { name: `${person.firstName} ${person.lastName}` })} · {formatDuration(booking.duration)}</span>
        </div>
        <p className="flex items-start gap-2 text-sm text-text-secondary">
          <MapPin size={16} className="mt-0.5 shrink-0" />
          {state.salon.name}, {state.salon.address}, {state.salon.area}
        </p>
        <p className="border-t border-border pt-3 text-sm">
          <strong>{formatMoney(booking.price)}</strong> · {t("booking.payAtSalon")}
        </p>
      </Card>

      {cancelled ? (
        <ButtonLink href={rebookLink(state.salon.slug, booking.serviceId)} size="lg" className="w-full">{t("booking.bookNewTime")}</ButtonLink>
      ) : (
        active && (
          <div className="space-y-3">
            <BookingActions state={state} now={now} booking={booking} />
            {changeRule(booking, now.today, now.minutes) === "free" && <p className="text-sm text-text-secondary">{freeUntilText(booking)}</p>}
          </div>
        )
      )}

      {active && !cancelled && <MessagePreviews state={state} booking={booking} now={now} />}
      <ReviewForm state={state} booking={booking} now={now} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <Link href={myBookingsFor(state.salon.slug, booking.customerId)} className="flex min-h-11 items-center font-medium text-action underline-offset-2 hover:underline">
          {t("booking.seeMyBookings")}
        </Link>
        <Link href={bookingHome(state.salon.slug)} className="flex min-h-11 items-center text-text-secondary underline-offset-2 hover:underline">
          {t("booking.backToSalon")}
        </Link>
      </div>
    </div>
  );
}
