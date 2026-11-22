"use client";

import { moduleEnabled } from "../modules/registry";
import { useState, type ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t, type MessageKey } from "../i18n";
import { formatDayLong, formatDuration, formatTime } from "../i18n/format";
import { useServerBook } from "../server-salon";
import { targetOf } from "../store";
import { commitAction } from "../store/commit";
import { newActionRequestId } from "../support/action-reference";
import type { ActionFailureInfo } from "../ui/action-failure";
import { StaffAvatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Field, TextInput } from "../ui/controls";
import { salonClock } from "../tools/clock";
import { useCommit } from "../ui/use-commit";
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
  const [run, pending] = useCommit();
  const book = useServerBook();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [failure, setFailure] = useState<{ key: MessageKey; minutes?: number }>();

  const terms = quote(state.cancellationPolicy, service, state.localization.currency, !findCustomerByPhone(state, guest.phone));

  // A deposit is not taken on the server yet, and no guest is known there until a phone number can be verified: the salon takes these by phone.
  const callForDeposit = (book && terms.depositMinor > 0) || failure?.key === "booking.depositByPhone";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const confirmOnServer = () => run(async () => {
    if (!book || !isGuestValid(guest) || !validEmail) return;
    const request = { serviceId, staffId: slot.staffId, date: slot.date, start: slot.start, name: guest.name.trim(), phone: guest.phone.trim(), email: email.trim(), website };
    setFailure(undefined);
    const result = await book(request);
    if (result.ok) return onBooked(result.booking);
    if (result.reason === "unavailable") return setFailure({ key: "booking.failed" });
    if (result.reason === "rate_limited") return setFailure({ key: "booking.tooManyAttempts", minutes: result.minutes });
    if (result.reason === "deposit_unsupported") return setFailure({ key: "booking.depositByPhone" });
    onTaken({ requestId: newActionRequestId(), reason: result.reason === "terms_changed" ? "booking.summary.changed" : "booking.slotTaken" });
  });

  const confirm = () => run(async () => {
    const target = targetOf(state);
    if (!isGuestValid(guest)) return;
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const day = formatDayLong(slot.date);
    const requestId = newActionRequestId();
    let reason: MessageKey = "booking.slotTaken";
    const clock = salonClock();
    const result = target && await commitAction(target, {
      type: terms.depositMinor ? "online/hold" : "online/book",
      guest: { name, phone, at: { date: clock.today, time: clock.minutes } },
      serviceId, staffId: slot.staffId, date: slot.date, start: slot.start,
      notice: {
        title: t("booking.inboxTitle"),
        body: t("booking.inboxBody", { service: service.name, staff: person.firstName, day, time: formatTime(slot.start) }),
      },
    }, {
      guard: current => {
        // The lead time is judged when the booking is saved, not when the customer opened the form.
        const at = salonClock();
        if (hoursUntil(slot, at.today, at.minutes, Math.floor(Date.now() / 60_000) * 60_000) * 60 < LEAD_MINUTES) return false;
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
      },
    }).catch(() => null);
    // Any refusal (time taken, lead time passed, terms changed, salon replaced) sends the customer back to choose.
    if (!result || !result.ok) return onTaken({ requestId, reason });
    // The saved state is this commit's: its newest hold or booking is the customer's.
    if (terms.depositMinor) onHeld(result.state.checkoutHolds.at(-1)!);
    else onBooked(result.state.bookings.at(-1)!);
  });

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
      {callForDeposit ? (
        <p role="status" className="rounded-lg bg-surface-2 p-4">{t("booking.depositByPhone", { phone: state.salon.phone })}</p>
      ) : (
      <form className="booking-checkout" onSubmit={event => { event.preventDefault(); void (book ? confirmOnServer() : confirm()); }}>
        <div className="space-y-3">
          <GuestFields value={guest} onChange={setGuest} />
          {book ? (
            <>
              <Field label={t("booking.yourEmail")} hint={t("booking.emailHint")}>
                <TextInput required value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder={t("booking.emailPlaceholder")} />
              </Field>
              {/* The honeypot: out of sight and of the tab order, so only a script fills it. */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
                <TextInput name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </>
          ) : <RememberContact checked={remember} onChange={chooseRemember} />}
        </div>
        <BookingSummary slot={slot} terms={terms} now={now} phone={state.salon.phone} packagesEnabled={moduleEnabled(state.modules, "packages")} demo={!book} />
        <div className="space-y-2">
          <Button type="submit" size="lg" className="w-full" disabled={pending || !isGuestValid(guest) || (!!book && !validEmail)}>
            {t(terms.depositMinor ? "protection.continue" : "booking.confirm")}
          </Button>
          {failure && <p role="alert" className="text-meta text-danger">{t(failure.key, { minutes: failure.minutes ?? 0, phone: state.salon.phone })}</p>}
          {!isGuestValid(guest) || (book && !validEmail) ? <p className="text-meta text-text-secondary">{t(book ? "booking.confirmDisabledEmail" : "booking.confirmDisabled")}</p> : null}
        </div>
        {book && <p className="text-meta text-text-secondary">{t("booking.processorNotice", { salon: state.salon.name })}</p>}
      </form>
      )}
    </div>
  );
}
