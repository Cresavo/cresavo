"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Navigation, Share2 } from "lucide-react";
import { BookingActions } from "../booking/booking-actions";
import { buildIcs, googleCalendarLink, icsTimestamp } from "../booking/ics";
import { mapLink } from "../booking/links";
import { freeUntilText } from "../booking/deadline-text";
import { changeRule } from "../booking/policy";
import { PaymentSummary, policyText } from "../booking/policy-summary";
import { VisitTicket } from "../booking/visit-ticket";
import { shareVisit } from "../booking/share-visit";
import type { Booking, DemoState } from "../data/types";
import { getActiveLocale, t } from "../i18n";
import { formatDayLong, formatMoney, formatTime } from "../i18n/format";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { findService } from "../selectors";
import { usePublicDemo } from "../store";
import { StaffAvatar } from "../ui/avatar";
import { Button, buttonClass } from "../ui/button";
import { showToast } from "../ui/toast";
import { useSalonNow } from "../use-now";
import { SALON, telHref } from "./salon";

/**
 * The receipt a visitor sees on a showcase site after they book. It is the
 * same ticket, pay summary and change actions as the booking engine, but every
 * path stays on this salon's site and calendar text follows the page language
 * (Swedish), not the demo state's default English locale.
 */
export function ShowcaseConfirmation({
  id,
  onBack,
  onBookAgain,
  onOpen,
  sharePath,
}: {
  id: string;
  onBack: () => void;
  onBookAgain: (serviceId: string) => void;
  onOpen: (id: string) => void;
  sharePath: string;
}) {
  const state = usePublicDemo();
  const now = useSalonNow();
  const [history, setHistory] = useState(false);
  useEffect(() => {
    document.getElementById("boka")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [id]);
  const booking = state?.bookings.find((item) => item.id === id);
  const service = state && findService(state, booking?.serviceId);
  const person = state?.staff.find((item) => item.id === booking?.staffId);

  if (!state || !booking || !service || !person) {
    return (
      <p className="py-8">
        Bokningen gick inte att visa. Ring oss på{" "}
        <a className="font-medium text-action underline" href={telHref()}>{SALON.phone}</a>
        {" "}så hjälper vi dig.{" "}
        <Button variant="link" onClick={onBack}>Tillbaka</Button>
      </p>
    );
  }

  const language = getActiveLocale();
  const treatment = serviceCopy(service, language).name;
  const cancelled = booking.status === "cancelled";
  const missed = booking.status === "noshow";
  const rule = changeRule(booking, now.today, now.minutes, now.instant);
  const active = rule !== "past";
  const title = cancelled ? t("booking.confirmation.cancelled") : missed ? t("booking.confirmation.noshow") : active ? t("booking.confirmation.title") : t("booking.confirmation.past");
  const mine = state.bookings.filter((item) => item.customerId === booking.customerId);
  const googleHref = googleCalendarLink({ booking, service, salon: state.salon, language });
  const mapHref = mapLink(state.salon.address, state.salon.area);

  const downloadCalendar = () => {
    const ics = buildIcs({ booking, service, staff: person, salon: state.salon, language, createdAt: icsTimestamp(new Date()) });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.salon.slug}-${booking.date}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const result = await shareVisit({
      salon: state.salon.name,
      date: booking.date,
      start: booking.start,
      url: new URL(sharePath, window.location.origin).href,
    });
    if (result === "copied") showToast(t("booking.share.copied"));
    if (result === "failed") showToast(t("booking.share.failed"));
  };

  if (history) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <h2 className="text-h2 font-semibold tracking-tight">{t("booking.seeMyBookings")}</h2>
        <ul className="divide-y divide-hairline">
          {mine.map((item) => {
            const itemService = findService(state, item.serviceId);
            const name = itemService ? serviceCopy(itemService, language).name : "";
            return (
              <li key={item.id}>
                <Button
                  variant="link"
                  className="flex min-h-11 w-full items-baseline justify-between gap-4 py-3 text-left no-underline"
                  onClick={() => { setHistory(false); onOpen(item.id); }}
                >
                  <span className="font-medium">{name}</span>
                  <span className="text-meta text-text-secondary">{formatDayLong(item.date, language)} · {formatTime(item.start, language)}</span>
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="link" onClick={() => setHistory(false)}>{t("booking.backToSalon")}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5" data-showcase-confirmation="">
      <div className="space-y-2 text-center">
        <h1 className="text-h1 font-semibold tracking-tight">{title}</h1>
        {(active || cancelled) && (
          <p className="text-text-secondary">{t(cancelled ? "booking.confirmation.cancelledText" : "booking.confirmation.text")}</p>
        )}
      </div>

      <VisitTicket
        treatment={treatment}
        date={booking.date}
        start={booking.start}
        duration={booking.duration}
        visitFor={booking.visitFor}
        place={state.salon}
        staff={
          <div className="flex items-center gap-3">
            <StaffAvatar person={person} size="md" />
            <span className="min-w-0 text-body font-medium">{t("booking.withStaff", { name: `${person.firstName} ${person.lastName}` })}</span>
          </div>
        }
      >
        {booking.protection ? (
          <PaymentSummary booking={booking} state={state} active={active} />
        ) : (
          <p className="border-t border-hairline pt-3 text-meta">
            <strong>{formatMoney(booking.price, state.localization.currency)}</strong>
          </p>
        )}
      </VisitTicket>

      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<CalendarPlus size={16} />} onClick={downloadCalendar}>{t("booking.calendarFile")}</Button>
          <a href={mapHref} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            <Navigation aria-hidden size={16} />
            {t("booking.directions")}
          </a>
          <a href={googleHref} target="_blank" rel="noopener noreferrer" className={buttonClass("link")} data-calendar="google">
            {t("booking.googleCalendar")}
          </a>
          <Button variant="link" icon={<Share2 size={16} />} onClick={share}>{t("booking.share")}</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={active ? "secondary" : "primary"} onClick={() => onBookAgain(booking.serviceId)}>
          {t("booking.me.rebook")}
        </Button>
        {active && (
          <a href="#manage" className={buttonClass("secondary")}>{t("booking.manageLink")}</a>
        )}
      </div>

      <div id="manage" className="scroll-mt-4 space-y-3">
        {active && <BookingActions state={state} now={now} booking={booking} />}
        {rule === "free" && <p className="text-meta text-text-secondary">{freeUntilText(booking)}</p>}
        {active && booking.protection && <p className="text-meta text-text-secondary">{policyText(booking.protection.terms)}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 text-meta">
        {mine.length > 1 && (
          <Button variant="link" onClick={() => setHistory(true)}>{t("booking.seeMyBookings")}</Button>
        )}
        <Button variant="secondary" onClick={onBack}>{t("booking.backToSalon")}</Button>
      </div>
    </div>
  );
}

/** Google Calendar and share targets for a showcase receipt: Swedish copy, never the engine booking page. */
export function showcaseCalendarLinks(state: DemoState, booking: Booking, sharePath: string, language = getActiveLocale()) {
  const service = findService(state, booking.serviceId);
  if (!service) return null;
  return {
    googleHref: googleCalendarLink({ booking, service, salon: state.salon, language }),
    sharePath,
  };
}
