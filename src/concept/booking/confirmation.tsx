"use client";

import { moduleEnabled } from "../modules/registry";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { useServerSalon } from "../server-salon";
import { usePublicDemo } from "../store";
import { ActionFailure } from "../ui/action-failure";
import { StaffAvatar } from "../ui/avatar";
import { Button, ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { useSalonNow } from "../use-now";
import { PaymentSummary, policyText } from "./policy-summary";
import { BookingActions } from "./booking-actions";
import { freeUntilText } from "./deadline-text";
import { changeRule } from "./policy";
import { bookingHome, bookingPage, myBookingsFor } from "./links";
import { MessagePreviews } from "./message-previews";
import { canWriteReview, ReviewForm } from "./review-form";
import { RepeatBookingLink } from "./repeat-booking-link";
import { findService } from "../selectors";

/** What the customer sees after booking, and the page behind the link in their confirmation. */
/** `onBack`: shown in place on the salon's own page, where going back is closing the receipt rather than following a link. */
export function Confirmation({ id, onBack }: { id: string; onBack?: () => void }) {
  const state = usePublicDemo();
  const now = useSalonNow();
  // On a salon's own page the visit is the salon's; changing it and previewing messages come with later steps, so the customer is asked to call.
  const fromServer = useServerSalon() !== null;
  const booking = state?.bookings.find((b) => b.id === id);
  const service = state && findService(state, booking?.serviceId);
  const person = state?.staff.find((s) => s.id === booking?.staffId);
  if (!state || !booking || !service || !person) {
    return (
      <Card className="mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-h3 font-semibold">{t("booking.notFound.title")}</p>
        <ActionFailure failure={{ requestId: id, reason: "booking.notFound.text" }} audience="booking" />
        <ButtonLink href={bookingHome(state?.salon.slug ?? "")}>{t("booking.notFound.action")}</ButtonLink>
      </Card>
    );
  }

  const cancelled = booking.status === "cancelled";
  const missed = booking.status === "noshow";
  const rule = changeRule(booking, now.today, now.minutes, now.instant);
  const active = rule !== "past";
  const reviewIsPrimary = canWriteReview(state, booking);
  const title = active ? "booking.confirmation.title" : ({
    booked: "booking.confirmation.past",
    completed: "booking.confirmation.completed",
    cancelled: "booking.confirmation.cancelled",
    noshow: "booking.confirmation.noshow",
  } as const)[booking.status];
  const Icon = cancelled || missed ? XCircle : CheckCircle2;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="space-y-2 text-center">
        {cancelled || missed ? (
          <span data-tone="danger" className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-bg text-text">
            <Icon data-tone-mark size={36} className="text-danger" />
          </span>
        ) : (
          <Icon size={44} className="mx-auto text-action" />
        )}
        <h1 className="text-h1 font-semibold tracking-tight">{t(title)}</h1>
        {(active || cancelled) && <p className="text-text-secondary">{t(cancelled ? "booking.confirmation.cancelledText" : "booking.confirmation.text")}</p>}
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <p className="text-h3 font-semibold">{service.name}</p>
          <p className="mt-1 flex items-center gap-2 text-body">
            <CalendarCheck size={16} className="shrink-0 text-action" />
            {formatDayLong(booking.date)}, {formatTime(booking.start)}–{formatTime(booking.start + booking.duration)}
          </p>
        </div>
        {booking.visitFor && <p className="text-body">{t("booking.for.visit", { name: booking.visitFor })}</p>}
        <div className="flex items-center gap-3 text-meta text-text-secondary">
          <StaffAvatar person={person} size="sm" />
          <span>{t("booking.withStaff", { name: `${person.firstName} ${person.lastName}` })} · {formatDuration(booking.duration)}</span>
        </div>
        <p className="flex items-start gap-2 text-meta text-text-secondary">
          <MapPin size={16} className="mt-1 shrink-0" />
          {[state.salon.name, state.salon.address, state.salon.area].filter(Boolean).join(", ")}
        </p>
        {booking.protection ? <PaymentSummary booking={booking} state={state} active={active} /> : <p className="border-t border-hairline pt-3 text-meta">
          <strong>{formatMoney(booking.price, state.localization.currency)}</strong>
          {active && <> · {t(moduleEnabled(state.modules, "packages") ? "booking.payAtSalonWithPackages" : "booking.payAtSalon")}</>}
        </p>}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {!fromServer && <RepeatBookingLink state={state} booking={booking} variant={reviewIsPrimary ? "secondary" : "primary"} />}
        {active && !fromServer && <ButtonLink href={`${bookingPage(state.salon.slug, booking.id)}#manage`} variant="secondary">{t("booking.manageLink")}</ButtonLink>}
      </div>
      <div id="manage" className="scroll-mt-4 space-y-3">
        {active && (fromServer ? <p className="text-meta">{t("booking.changeByPhone", { phone: state.salon.phone })}</p> : <BookingActions state={state} now={now} booking={booking} />)}
        {rule === "free" && <p className="text-meta text-text-secondary">{freeUntilText(booking)}</p>}
        {active && booking.protection && <p className="text-meta text-text-secondary">{policyText(booking.protection.terms)}</p>}
      </div>

      {active && !cancelled && !fromServer && <MessagePreviews state={state} booking={booking} now={now} />}
      {!fromServer && <ReviewForm state={state} booking={booking} now={now} variant="primary" />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 text-meta">
        {!fromServer && <Link href={myBookingsFor(state.salon.slug, booking.customerId)} className="flex min-h-11 items-center font-medium text-action underline-offset-2 hover:underline">
          {t("booking.seeMyBookings")}
        </Link>}
        {onBack ? <Button variant="secondary" onClick={onBack}>{t("booking.backToSalon")}</Button> : (
          <Link href={bookingHome(state.salon.slug)} className="flex min-h-11 items-center text-text-secondary underline-offset-2 hover:underline">
            {t("booking.backToSalon")}
          </Link>
        )}
      </div>
    </div>
  );
}
