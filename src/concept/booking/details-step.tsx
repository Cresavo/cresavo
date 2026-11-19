"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { currentState, dispatchWithLog, withBookingLock } from "../store";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { salonClock } from "../tools/clock";
import type { Now } from "../use-now";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { hoursUntil, LEAD_MINUTES } from "./policy";
import { quote, type CheckoutHold } from "./protection";
import { PolicySummary } from "./policy-summary";
import { findCustomerByPhone } from "./lookup";
import { showToast } from "../ui/toast";
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
  onTaken: () => void;
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
    setPending(true);
    const latest = await withBookingLock(() => {
      const clock = salonClock();
      if (hoursUntil(slot, clock.today, clock.minutes, Math.floor(Date.now() / 60_000) * 60_000) * 60 < LEAD_MINUTES) return;
      let changed = false;
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
        const fresh = quote(current.cancellationPolicy, offering, current.localization.currency, !findCustomerByPhone(current, phone));
        changed = JSON.stringify(fresh) !== JSON.stringify(terms) || offering.duration !== service.duration;
        return !changed;
      });
      if (changed) return "changed";
      if (result === false) return;
      return terms.depositMinor ? currentState()?.checkoutHolds.at(-1) : currentState()?.bookings.at(-1);
    });
    setPending(false);
    if (latest === "changed") return showToast(t("protection.changed"));
    if (!latest) return onTaken();
    if ("expiresAt" in latest) onHeld(latest);
    else onBooked(latest);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg bg-surface-2 p-4">
        <p className="text-sm text-text-secondary">{t(suggested ? "booking.nextAvailable" : "booking.yourVisit")}</p>
        <h2 className="font-semibold">{service.name}</h2>
        <p aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-[15px]">
          <CalendarCheck size={16} className="shrink-0 text-action" />
          {formatDayLong(slot.date)}, {formatTime(slot.start)}–{formatTime(slot.start + service.duration)}
        </p>
        <p className="flex items-center gap-2 text-sm text-text-secondary">
          <StaffAvatar person={person} size="sm" />
          {t("booking.withStaff", { name: person.firstName })} · {formatDuration(service.duration)} · {formatMoney(service.price)}
        </p>
        {timeControl}
      </div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <GuestFields value={guest} onChange={setGuest} />
        <RememberContact checked={remember} onChange={chooseRemember} />
        <PolicySummary terms={terms} visit={slot} />
        {hoursUntil(slot, now.today, now.minutes, now.instant) < terms.freeHours && <p className="text-sm">{t(state.salon.phone ? "booking.tooLate" : "booking.tooLateNoPhone", { hours: terms.freeHours, phone: state.salon.phone })}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending || !isGuestValid(guest)}>
          {t(terms.depositMinor ? "protection.continue" : "booking.confirm")}
        </Button>
        {!isGuestValid(guest) && <p className="text-sm text-text-secondary">{t("booking.confirmDisabled")}</p>}
      </form>
    </div>
  );
}
