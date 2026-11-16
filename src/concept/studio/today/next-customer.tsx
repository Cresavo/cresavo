"use client";

import { CalendarClock, Phone, UserRound } from "lucide-react";
import { addDays, formatTime } from "../../data/dates";
import type { Booking } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, formatDuration, relativeDay } from "../../i18n/format";
import { buildCustomerStats, dayBookings, findCustomer, findService, fullName } from "../../selectors";
import { Avatar } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Button, ButtonLink, buttonClass } from "../../ui/button";
import { Card } from "../../ui/card";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

function findNext(bookings: Booking[], now: number) {
  return bookings.find((b) => b.status === "booked" && b.start + b.duration > now);
}

/** The next (or current) customer with the facts you need before they walk in. */
export function NextCustomer({ onOpen }: { onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  let booking = findNext(dayBookings(state, today), minutes);
  for (let i = 1; !booking && i < 7; i++) booking = dayBookings(state, addDays(today, i))[0];
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-eko-accent-soft/70 px-5 py-2.5 text-sm">
        <span className="font-medium text-eko-accent">{isToday ? t("next.title") : t("next.titleLater")}</span>
        <span className="font-semibold tabular-nums text-eko-accent">{when}</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={fullName(customer)} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">{fullName(customer)}</p>
            <p className="truncate text-sm text-eko-muted">{service?.name} · {formatDuration(booking.duration)}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-eko-muted">
              <StaffDot staffId={staff.id} />
              {t("next.with", { name: staff.firstName, time: formatTime(booking.start) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stats && <Badge>{tc("next.visits", stats.visits)}</Badge>}
          {stats?.lastVisit && <Badge>{t("next.lastVisit", { ago: agoText(stats.lastVisit, today) })}</Badge>}
          {customer.tags.map((tag) => <Badge key={tag} tone={tag === "Diabetes" ? "warn" : "neutral"}>{tag}</Badge>)}
        </div>
        {customer.note && <p className="rounded-xl bg-eko-warn-soft px-3.5 py-2.5 text-sm">{customer.note}</p>}
        {advice && (
          <p className="text-sm text-eko-muted">
            <span className="font-medium text-eko-ink">{t("next.lastAdvice")} </span>
            {advice}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <ButtonLink href={`/studio/customers/${customer.id}`} variant="secondary" size="sm" className="px-2" icon={<UserRound size={16} />}>
            {t("next.profile")}
          </ButtonLink>
          <Button variant="secondary" size="sm" className="px-2" icon={<CalendarClock size={16} />} onClick={() => onOpen({ kind: "booking", id: booking.id, mode: "move" })}>
            {t("booking.move")}
          </Button>
          <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "sm", "px-2")}>
            <Phone size={16} />
            {t("next.call")}
          </a>
        </div>
      </div>
    </Card>
  );
}
