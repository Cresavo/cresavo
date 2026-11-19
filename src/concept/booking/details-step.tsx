"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../i18n/format";
import { currentState, dispatch, withBookingLock } from "../store";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import type { Now } from "../use-now";
import { GuestFields, isGuestValid, type GuestInput } from "./guest-fields";
import { rememberGuest } from "./guest";
import { bookingPage } from "./links";
import type { OpenSlot } from "./suggest";

interface DetailsStepProps {
  state: DemoState;
  now: Now;
  serviceId: string;
  slot: OpenSlot;
  guest: GuestInput;
  onGuestChange: (guest: GuestInput) => void;
  /** The time was taken while the customer typed: go back and choose again. */
  onTaken: () => void;
  onBooked?: (id: string) => void;
}

/** Last step: confirm the chosen time with name and phone number. */
export function DetailsStep({ state, now, serviceId, slot, guest, onGuestChange, onTaken, onBooked }: DetailsStepProps) {
  const router = useRouter();
  const service = state.services.find((s) => s.id === serviceId)!;
  const person = state.staff.find((s) => s.id === slot.staffId)!;
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    if (pending || !isGuestValid(guest)) return;
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const day = formatDayLong(slot.date);
    setPending(true);
    const latest = await withBookingLock(() => {
      const booked = dispatch({
        type: "online/book",
        guest: { name, phone, at: { date: now.today, time: now.minutes } },
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
    rememberGuest({ name, phone, customerId: latest.customerId });
    if (onBooked) onBooked(latest.id);
    else router.push(bookingPage(state.salon.slug, latest.id));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg bg-surface-2 p-4">
        <p className="font-semibold">{service.name}</p>
        <p className="flex items-center gap-2 text-[15px]">
          <CalendarCheck size={16} className="shrink-0 text-action" />
          {formatDayLong(slot.date)}, {formatTime(slot.start)}–{formatTime(slot.start + service.duration)}
        </p>
        <p className="flex items-center gap-2 text-sm text-text-secondary">
          <StaffAvatar person={person} size="sm" />
          {t("booking.withStaff", { name: person.firstName })} · {formatDuration(service.duration)} · {formatMoney(service.price)}
        </p>
      </div>
      <GuestFields value={guest} onChange={onGuestChange} />
      <Button size="lg" className="w-full" disabled={pending || !isGuestValid(guest)} onClick={confirm}>
        {t("booking.confirm")}
      </Button>
      <p className="text-center text-sm text-text-secondary">{isGuestValid(guest) ? t("booking.confirmNote") : t("booking.confirmDisabled")}</p>
    </div>
  );
}
