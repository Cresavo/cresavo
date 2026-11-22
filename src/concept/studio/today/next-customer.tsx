"use client";

import { CalendarClock, Phone, UserRound } from "lucide-react";
import { addDays } from "../../data/dates";
import type { Booking, StaffId } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, formatDuration, relativeDay, formatTime } from "../../i18n/format";
import { buildCustomerStats, dayBookings, findCustomer, findService, fullName } from "../../selectors";
import { Avatar } from "../../ui/avatar";
import { Tag } from "../../ui/badge";
import { Button, ButtonLink, buttonClass } from "../../ui/button";
import { Notice } from "../../ui/notice";
import { Card, Section } from "../../ui/card";
import type { OpenSheet } from "../booking/booking-sheets";
import { JournalRead } from "../customers/journal-read";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

function findNext(bookings: Booking[], now: number) {
  return bookings.find((b) => b.status === "booked" && b.start + b.duration > now);
}

/** The next (or current) customer with the facts you need before they walk in. */
export function NextCustomer({ staffId, onOpen }: { staffId?: StaffId; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  let booking = findNext(dayBookings(state, today, staffId), minutes);
  for (let i = 1; !booking && i < 7; i++) booking = dayBookings(state, addDays(today, i), staffId)[0];
  if (!booking) return null;

  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find((s) => s.id === booking.staffId)!;
  if (!customer) return null;
  const stats = buildCustomerStats(state, today).get(customer.id);
  const isToday = booking.date === today;
  const inMinutes = booking.start - minutes;
  const when = !isToday
    ? `${relativeDay(booking.date, today)} ${formatTime(booking.start)}`
    : inMinutes <= 0
      ? t("next.now")
      : inMinutes < 60
        ? tc("next.inMinutes", inMinutes)
        : t("next.at", { time: formatTime(booking.start) });
  const advice = state.modules.journal ? state.journals.filter((j) => j.customerId === customer.id).at(-1)?.advice : undefined;

  return (
    <Section title={isToday ? t("next.title") : t("next.titleLater")} >
      <Card surface="raised" className="space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={fullName(customer)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="min-w-0 truncate text-h2 font-semibold tracking-tight">{fullName(customer)}</span>
              <span className="shrink-0 text-body font-semibold tabular-nums">{when}</span>
            </p>
            <p className="truncate text-sm text-text-secondary">{service?.name}, {formatDuration(booking.duration)}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
              <StaffDot staffId={staff.id} />
              {t("next.with", { name: staff.firstName, time: formatTime(booking.start) })}
            </p>
          </div>
          {booking.example && <Tag className="self-start">{t("setup.example.tag")}</Tag>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
          {stats && <span>{tc("next.visits", stats.visits)}</span>}
          {stats?.lastVisit && <span>{t("next.lastVisit", { ago: agoText(stats.lastVisit, today) })}</span>}
          {customer.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
        {customer.note && <Notice tone="warning">{customer.note}</Notice>}
        {advice && (
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text">{t("next.lastAdvice")} </span>
            {advice}
            <JournalRead customerId={customer.id} />
          </p>
        )}
        <div className="flex flex-wrap gap-2 [&>*]:flex-1">
          <ButtonLink href={`/studio/customers/${customer.id}`} variant="secondary" size="sm" className="px-2" icon={<UserRound size={16} />}>
            {t("next.profile")}
          </ButtonLink>
          <Button variant="secondary" size="sm" className="px-2" icon={<CalendarClock size={16} />} onClick={() => onOpen({ kind: "booking", id: booking.id, mode: "move" })}>
            {t("booking.move")}
          </Button>
          {customer.phone.trim() && <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "sm", "px-2")}>
            <Phone size={16} />
            {t("next.call")}
          </a>}
        </div>
      </Card>
    </Section>
  );
}
