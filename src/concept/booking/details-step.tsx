"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatTime } from "../i18n/format";
import { currentState, dispatchWithLog, withBookingLock } from "../store";
import { newActionRequestId } from "../support/action-reference";
import type { ActionFailureInfo } from "../ui/action-failure";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { salonClock } from "../tools/clock";
import type { Now } from "../use-now";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { changeRule, hoursUntil, LEAD_MINUTES } from "./policy";
import { BookingSummary } from "./booking-summary";
import type { useGuestContact } from "./guest";
import { bookingPage } from "./links";
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
  onBooked?: (id: string) => void;
}

/** Last step: confirm the chosen time with name and phone number. */
export function DetailsStep({ state, now, serviceId, slot, contact, suggested, timeControl, onTaken, onBooked }: DetailsStepProps) {
  const { guest, setGuest, remember, chooseRemember, saveContact } = contact;
  const router = useRouter();
  const service = state.services.find((s) => s.id === serviceId)!;
  const person = state.staff.find((s) => s.id === slot.staffId)!;
  const [pending, setPending] = useState(false);

  const late = changeRule({ ...slot, status: "booked" }, now.today, now.minutes) !== "free";
  const confirm = async () => {
    if (pending || !isGuestValid(guest)) return;
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const day = formatDayLong(slot.date);
    const requestId = newActionRequestId();
    let failureMessage = t("booking.slotTaken");
    setPending(true);
    const latest = await withBookingLock(() => {
      const clock = salonClock();
      if (hoursUntil(slot, clock.today, clock.minutes) * 60 < LEAD_MINUTES) return;
      const booked = dispatchWithLog({
        type: "online/book",
        guest: { name, phone, at: { date: clock.today, time: clock.minutes } },
        serviceId,
        staffId: slot.staffId,
        date: slot.date,
        start: slot.start,
        notice: {
          title: t("booking.inboxTitle"),
          body: t("booking.inboxBody", { service: service.name, staff: person.firstName, day, time: formatTime(slot.start) }),
        },
      }, undefined, current => {
        const treatment = current.services.find(item => item.id === serviceId);
        if (!treatment) return false;
        if (treatment.price === service.price && treatment.duration === service.duration && current.localization.currency === state.localization.currency) return true;
        failureMessage = t("booking.summary.changed");
        return false;
      });
      return booked !== false ? currentState()?.bookings.at(-1) : undefined;
    }).catch(() => false as const);
    setPending(false);
    if (!latest) return onTaken({ requestId, message: failureMessage });
    saveContact(latest.customerId);
    if (onBooked) onBooked(latest.id);
    else router.push(bookingPage(state.salon.slug, latest.id));
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
          {t("booking.withStaff", { name: person.firstName })} · {formatDuration(service.duration)}
        </p>
        {timeControl}
      </div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <GuestFields value={guest} onChange={setGuest} />
        <RememberContact checked={remember} onChange={chooseRemember} />
        <BookingSummary slot={slot} price={service.price} currency={state.localization.currency} late={late} phone={state.salon.phone} />
        <Button type="submit" size="lg" className="w-full" disabled={pending || !isGuestValid(guest)}>
          {t("booking.confirm")}
        </Button>
        {!isGuestValid(guest) && <p className="text-sm text-text-secondary">{t("booking.confirmDisabled")}</p>}
      </form>
    </div>
  );
}
