"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { currentState, dispatch, withBookingLock } from "../store";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { salonClock } from "../tools/clock";
import type { Now } from "../use-now";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { changeRule, FREE_CHANGE_HOURS } from "./policy";
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
  onTaken: () => void;
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
    setPending(true);
    const latest = await withBookingLock(() => {
      const clock = salonClock();
      const booked = dispatch({
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
      });
      return booked ? currentState()?.bookings.at(-1) : undefined;
    });
    setPending(false);
    if (!latest) return onTaken();
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
          {t("booking.withStaff", { name: person.firstName })} · {formatDuration(service.duration)} · {formatMoney(service.price)}
        </p>
        {timeControl}
      </div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <GuestFields value={guest} onChange={setGuest} />
        <RememberContact checked={remember} onChange={chooseRemember} />
        <p className="text-sm text-text-secondary">{late && state.salon.phone ? t("booking.beforeConfirmLate", { phone: state.salon.phone, hours: FREE_CHANGE_HOURS }) : t("booking.beforeConfirm", { hours: FREE_CHANGE_HOURS })}</p>
        <Button type="submit" size="lg" className="w-full" disabled={pending || !isGuestValid(guest)}>
          {t("booking.confirm")}
        </Button>
        {!isGuestValid(guest) && <p className="text-sm text-text-secondary">{t("booking.confirmDisabled")}</p>}
      </form>
    </div>
  );
}
