"use client";

import { CalendarClock, Phone, UserRound } from "lucide-react";
import { addDays } from "../../data/dates";
import type { Booking, DateKey, DemoState, StaffId } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, formatDuration, relativeDay, formatTime } from "../../i18n/format";
import { buildCustomerStats, dayBookings, findCustomer, findService, fullName } from "../../selectors";
import { Tag } from "../../ui/badge";
import { Button, ButtonLink, buttonClass } from "../../ui/button";
import { Section } from "../../ui/card";
import type { OpenSheet } from "../booking/booking-sheets";
import { JournalRead } from "../customers/journal-read";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

/** Today's current or next visit: the first booked one that has not ended yet. */
export function nextToday(state: DemoState, today: DateKey, now: number, staffId?: StaffId): Booking | undefined {
  return dayBookings(state, today, staffId).find((b) => b.status === "booked" && b.start + b.duration > now);
}

/** When the next visit is, in words: now, in a few minutes, at a time, or on a later day. */
export function whenText(booking: Booking, today: DateKey, now: number) {
  if (booking.date !== today) return `${relativeDay(booking.date, today)} ${formatTime(booking.start)}`;
  const inMinutes = booking.start - now;
  return inMinutes <= 0 ? t("next.now") : inMinutes < 60 ? tc("next.inMinutes", inMinutes) : t("next.at", { time: formatTime(booking.start) });
}

/**
 * What you need before the customer walks in, set as plain lines under their row: visits and tags, the note as
 * one warm highlight, the last advice, and Profile, Move and Call as quiet actions.
 */
export function NextDetails({ booking, onOpen }: { booking: Booking; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today } = useStudio();
  const customer = findCustomer(state, booking.customerId);
  if (!customer) return null;
  const stats = buildCustomerStats(state, today).get(customer.id);
  const advice = state.modules.journal ? state.journals.filter((j) => j.customerId === customer.id).at(-1)?.advice : undefined;
  const facts = [stats && tc("next.visits", stats.visits), stats?.lastVisit && t("next.lastVisit", { ago: agoText(stats.lastVisit, today) }), ...customer.tags].filter(Boolean);
  return (
    <div className="space-y-2 text-sm text-text-secondary">
      {facts.length > 0 && <p>{facts.join(" · ")}</p>}
      {customer.note && (
        <p><mark className="box-decoration-clone rounded-xs bg-warning-bg px-1 py-0.5 font-medium text-text">{customer.note}</mark></p>
      )}
      {advice && (
        <p className="max-w-reading">
          <span className="font-medium text-text">{t("next.lastAdvice")} </span>
          {advice}
          <JournalRead customerId={customer.id} />
        </p>
      )}
      <div className="-ml-3 flex flex-wrap gap-x-1">
        <ButtonLink href={`/studio/customers/${customer.id}`} variant="tertiary" size="sm" icon={<UserRound size={16} aria-hidden />}>
          {t("next.profile")}
        </ButtonLink>
        <Button variant="tertiary" size="sm" icon={<CalendarClock size={16} aria-hidden />} onClick={() => onOpen({ kind: "booking", id: booking.id, mode: "move" })}>
          {t("booking.move")}
        </Button>
        {customer.phone.trim() && <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className={buttonClass("tertiary", "sm")}>
          <Phone size={16} aria-hidden />
          {t("next.call")}
        </a>}
      </div>
    </div>
  );
}

/** When today has nobody left: the first customer of the next open day, as one highlighted row with its details. */
export function NextDayCustomer({ staffId, onOpen }: { staffId?: StaffId; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  if (nextToday(state, today, minutes, staffId)) return null;
  let booking: Booking | undefined;
  for (let i = 1; !booking && i < 7; i++) booking = dayBookings(state, addDays(today, i), staffId)[0];
  const customer = booking && findCustomer(state, booking.customerId);
  if (!booking || !customer) return null;
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find((s) => s.id === booking.staffId)!;
  return (
    <Section title={t("next.titleLater")} action={<span className="text-body font-medium tabular-nums text-text-secondary">{whenText(booking, today, minutes)}</span>}>
      <div className="-mx-3 space-y-3 rounded-lg bg-surface p-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">{fullName(customer)}</p>
            <p className="text-sm text-text-secondary">{service?.name} · {formatDuration(booking.duration)}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
              <StaffDot staffId={staff.id} />
              {t("next.with", { name: staff.firstName, time: formatTime(booking.start) })}
            </p>
          </div>
          {booking.example && <Tag>{t("setup.example.tag")}</Tag>}
        </div>
        <NextDetails booking={booking} onOpen={onOpen} />
      </div>
    </Section>
  );
}
