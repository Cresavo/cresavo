"use client";

import { moduleEnabled } from "../modules/registry";
import { useState, type ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t, type MessageKey } from "../i18n";
import { formatDayLong, formatDuration, formatTime } from "../i18n/format";
import { currentState, dispatchWithLog, withBookingLock } from "../store";
import { newActionRequestId } from "../support/action-reference";
import type { ActionFailureInfo } from "../ui/action-failure";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { salonClock } from "../tools/clock";
import type { Now } from "../use-now";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { hoursUntil, LEAD_MINUTES } from "./policy";
import { quote, type CheckoutHold } from "./protection";
import { BookingSummary } from "./booking-summary";
import { findCustomerByPhone } from "./lookup";
import type { useGuestContact } from "./guest";
import type { OpenSlot } from "./suggest";

interface DetailsStepProps {
  state: DemoState;
  now: Now;
  serviceId: string;
  slot: OpenSlot;
  contact: ReturnType<typeof useGuestContact>;
  suggested: boolean;
  timeControl?: ReactNode;
  /** The time was taken while the customer typed: go back and choose again. */
  onTaken: (failure: ActionFailureInfo) => void;
  onBooked: (booking: Booking) => void;
  onHeld: (hold: CheckoutHold) => void;
}

/** Last step: confirm the chosen time with name and phone number. */
export function DetailsStep({ state, now, serviceId, slot, contact, suggested, timeControl, onTaken, onBooked, onHeld }: DetailsStepProps) {
  const { guest, setGuest, remember, chooseRemember } = contact;
  const service = state.services.find((s) => s.id === serviceId)!;
  const person = state.staff.find((s) => s.id === slot.staffId)!;
  const [pending, setPending] = useState(false);

  const terms = quote(state.cancellationPolicy, service, state.localization.currency, !findCustomerByPhone(state, guest.phone));

  const confirm = async () => {
    if (pending || !isGuestValid(guest)) return;
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const day = formatDayLong(slot.date);
    const requestId = newActionRequestId();
    let reason: MessageKey = "booking.slotTaken";
    setPending(true);
    const latest = await withBookingLock(() => {
      const clock = salonClock();
      if (hoursUntil(slot, clock.today, clock.minutes, Math.floor(Date.now() / 60_000) * 60_000) * 60 < LEAD_MINUTES) return;
      const result = dispatchWithLog({
        type: terms.depositMinor ? "online/hold" : "online/book",
        guest: { name, phone, at: { date: clock.today, time: clock.minutes } },
        serviceId, staffId: slot.staffId, date: slot.date, start: slot.start,
        notice: {
          title: t("booking.inboxTitle"),
          body: t("booking.inboxBody", { service: service.name, staff: person.firstName, day, time: formatTime(slot.start) }),
        },
      }, undefined, current => {
        const offering = current.services.find(s => s.id === serviceId);
        if (!offering || current.salon.slug !== state.salon.slug) return false;
        if (offering.duration !== service.duration || offering.price !== service.price || current.localization.currency !== terms.currency) {
          reason = "booking.summary.changed";
          return false;
        }
        const fresh = quote(current.cancellationPolicy, offering, current.localization.currency, !findCustomerByPhone(current, phone));
        if (JSON.stringify(fresh) !== JSON.stringify(terms)) {
          reason = "protection.changed";
          return false;
        }
        return true;
      });
      if (result === false) return;
      return terms.depositMinor ? currentState()?.checkoutHolds.at(-1) : currentState()?.bookings.at(-1);
    }).catch(() => false as const);
    setPending(false);
    if (!latest) return onTaken({ requestId, reason });
    if ("expiresAt" in latest) onHeld(latest);
    else onBooked(latest);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg bg-surface-2 p-4">
        <p className="text-meta text-text-secondary">{t(suggested ? "booking.nextAvailable" : "booking.yourVisit")}</p>
        <h2 className="text-h2 font-semibold">{service.name}</h2>
        <p aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-body">
          <CalendarCheck size={16} className="shrink-0 text-action" />
          {formatDayLong(slot.date)}, {formatTime(slot.start)}–{formatTime(slot.start + service.duration)}
        </p>
        <p className="flex items-center gap-2 text-meta text-text-secondary">
          <StaffAvatar person={person} size="sm" />
          {t("booking.withStaff", { name: person.firstName })} · {formatDuration(service.duration)}
        </p>
        {timeControl}
      </div>
      <form className="booking-checkout" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <div className="space-y-3">
          <GuestFields value={guest} onChange={setGuest} />
          <RememberContact checked={remember} onChange={chooseRemember} />
        </div>
        <BookingSummary slot={slot} terms={terms} now={now} phone={state.salon.phone} packagesEnabled={moduleEnabled(state.modules, "packages")} />
        <div className="space-y-2">
          <Button type="submit" size="lg" className="w-full" disabled={pending || !isGuestValid(guest)}>
            {t(terms.depositMinor ? "protection.continue" : "booking.confirm")}
          </Button>
          {!isGuestValid(guest) && <p className="text-meta text-text-secondary">{t("booking.confirmDisabled")}</p>}
        </div>
      </form>
    </div>
  );
}
