"use client";

import { moduleEnabled } from "../../modules/registry";
import { useState } from "react";
import { CalendarClock, CalendarX2, Check, Gift, Phone, UserRound } from "lucide-react";
import { paidWithCards, remainingForCards } from "../../giftcards/cards";
import { t, tc, type MessageKey } from "../../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../../i18n/format";
import { packageFor, visitsLeft } from "../../packages/packages";
import { findCustomer, findService, fullName } from "../../selectors";
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Badge } from "../../ui/badge";
import { dispatchWithLog, withBookingLock } from "../../store";
import { Button, ButtonLink } from "../../ui/button";
import { Chip, Switch } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { RedeemSheet } from "../giftcards/redeem-sheet";
import { dispatchWithUndoToast, showUndoToast } from "../log/undo-toast";
import { useStudio } from "../use-studio";
import { salonCancellationOnly } from "../../booking/settlement";
import { useSalonNow } from "../../use-now";
import { formatMinor } from "../../booking/policy-summary";
import { FeeDecisionPanel } from "./fee-decision";
import { SlotPicker, slotOnDate, type Slot } from "./slot-picker";
import { waitlistCount, waitlistNotice } from "./waitlist-notice";

type Mode = "details" | "move" | "cancel" | "giftcard";

const CANCEL_REASONS: MessageKey[] = ["cancel.reason.customer", "cancel.reason.ill", "cancel.reason.salon", "cancel.reason.other"];

/** Booking details with move and cancel flows. Mount it with `key={bookingId}`. */
export function BookingSheet({ bookingId, onClose, initialMode = "details" }: { bookingId: string; onClose: () => void; initialMode?: Mode }) {
  const { state, today, minutes } = useStudio();
  const clock = useSalonNow();
  const booking = state.bookings.find((b) => b.id === bookingId);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [date, setDate] = useState(booking?.date ?? today);
  const [picked, setSlot] = useState<Slot | null>(null);
  const slot = slotOnDate(picked, date);
  const [reason, setReason] = useState<MessageKey>(CANCEL_REASONS[0]);
  const [offer, setOffer] = useState(false);
  const [failure, setFailure] = useState<ActionFailureInfo>();
  if (!booking) return null;
  const go = (next: Mode) => { setFailure(undefined); setMode(next); };
  const report = (reason: MessageKey) => setFailure({ reason, requestId: newActionRequestId() });
  const failureNotice = failure && <ActionFailure failure={failure} />;

  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find((s) => s.id === booking.staffId)!;
  const name = customer ? fullName(customer) : "";
  const upcoming = booking.status === "booked" && (booking.date > today || (booking.date === today && booking.start + booking.duration > minutes));
  const finished = booking.status === "booked" && !upcoming;
  const when = `${formatDayLong(booking.date)} · ${formatTime(booking.start)}–${formatTime(booking.start + booking.duration)}`;
  const lastJournal = state.modules.journal
    ? state.journals.filter((j) => j.customerId === booking.customerId && j.date < booking.date).at(-1)
    : undefined;
  const waitlist = waitlistCount(state, booking);
  const pkg = moduleEnabled(state.modules, "packages") ? packageFor(state, booking) : undefined;
  const protection = booking.protection;
  const salonCancellation = salonCancellationOnly(booking, clock.instant ?? 0);
  const paidByCard = paidWithCards(state, booking.id);

  const markDone = () => {
    const usesStock = state.modules.stock && !!service?.consumption?.length;
    const first = customer?.firstName ?? "";
    const message = pkg ? t("booking.donePackageToast", { name: first, left: tc("packages.onLeft", visitsLeft(pkg) - 1) }) : t(usesStock ? "booking.doneStockToast" : "booking.doneToast", { name: first });
    if (dispatchWithUndoToast({ type: "booking/complete", id: booking.id }, message)) onClose();
    else report("booking.completeFailed");
  };

  const confirmMove = () => {
    if (!slot) return;
    const message = t("booking.movedToast", { name: customer?.firstName ?? "", when: `${formatDayLong(slot.date)} ${formatTime(slot.start)}` });
    if (dispatchWithUndoToast({ type: "booking/move", id: booking.id, date: slot.date, start: slot.start }, message)) onClose();
    else report("booking.move.failed");
  };

  const confirmCancel = async () => {
    const sendOffer = offer && waitlist > 0;
    const message = sendOffer ? tc("booking.cancelledOfferedToast", waitlist) : t("booking.cancelledToast");
    const result = await withBookingLock(() => dispatchWithLog({
      type: "booking/cancel",
      id: booking.id,
      reason: t(salonCancellation ? "cancel.reason.salon" : reason),
      notice: sendOffer ? waitlistNotice(booking, waitlist, { today, minutes }) : undefined,
    }, undefined, latest => {
      const current = latest.bookings.find(b => b.id === booking.id);
      return current?.status === "booked" && salonCancellationOnly(current, Date.now()) === salonCancellation &&
        current.date === booking.date && current.start === booking.start && current.staffId === booking.staffId;
    })).catch(() => false as const);
    if (showUndoToast(message, result)) onClose();
    else report("booking.visitChanged");
  };

  if (mode === "giftcard") return <RedeemSheet bookingId={booking.id} onBack={() => go("details")} onClose={onClose} />;

  if (mode === "move") {
    return (
      <Sheet
        open
        onClose={onClose}
        title={t("move.title", { name })}
        description={`${service?.name} · ${formatDuration(booking.duration)} · ${staff.firstName}`}
        footer={
          <>
            {failureNotice}
            <Button variant="ghost" onClick={() => go("details")}>{t("common.back")}</Button>
            <Button disabled={!slot} onClick={confirmMove}>{t("move.confirm")}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SlotPicker
            staffId={booking.staffId}
            need={booking}
            date={date}
            onDateChange={setDate}
            value={slot}
            onChange={setSlot}
            ignoreBookingId={booking.id}
          />
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-sm">
            <div>
              <p className="text-xs text-text-secondary">{t("move.before")}</p>
              <p className="font-medium">{formatDayLong(booking.date)}</p>
              <p className="tabular-nums">{formatTime(booking.start)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{t("move.after")}</p>
              <p className="font-medium">{slot ? formatDayLong(slot.date) : "–"}</p>
              <p className="tabular-nums">{slot ? formatTime(slot.start) : t("move.pickTime")}</p>
            </div>
          </div>
        </div>
      </Sheet>
    );
  }

  if (mode === "cancel") {
    return (
      <Sheet
        open
        onClose={onClose}
        title={t(salonCancellation ? "protection.salonCancel" : "cancel.title")}
        description={`${name} · ${when}`}
        footer={
          <>
            {failureNotice}
            <Button variant="ghost" onClick={() => go("details")}>{t("common.back")}</Button>
            <Button variant="danger" onClick={confirmCancel}>{t("cancel.confirm")}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {protection?.deposit && <p>{t("protection.returnDeposit", { amount: formatMinor(protection.terms.depositMinor, protection.terms.currency) })}</p>}
          {!salonCancellation && <div className="space-y-2">
            <p className="text-sm font-medium">{t("cancel.reason")}</p>
            <div className="flex flex-wrap gap-2">
              {CANCEL_REASONS.map((r) => (
                <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{t(r)}</Chip>
              ))}
            </div>
          </div>}
          {waitlist > 0 && (
            <div className="flex items-center gap-4 rounded-lg bg-surface-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("cancel.offer")}</p>
                <p className="text-sm text-text-secondary">{tc("cancel.offerHint", waitlist)}</p>
              </div>
              <Switch checked={offer} onChange={() => setOffer(!offer)} label={t("cancel.offer")} />
            </div>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={name}
      description={`${service?.name} · ${formatDuration(booking.duration)}`}
      footer={
        <>
          {failureNotice}
          {customer && (
            <ButtonLink href={`/studio/customers/${customer.id}`} variant="ghost" icon={<UserRound size={18} />}>
              {t("booking.customerCard")}
            </ButtonLink>
          )}
          {finished && (
            <Button icon={<Check size={18} />} onClick={markDone}>{t("booking.markDone")}</Button>
          )}
          {upcoming && (
            <>
              <Button variant="danger" icon={<CalendarX2 size={18} />} onClick={() => { setOffer(false); go("cancel"); }}>{t(salonCancellation ? "protection.salonCancel" : "booking.cancel")}</Button>
              <Button icon={<CalendarClock size={18} />} onClick={() => go("move")}>{t("booking.move")}</Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {booking.status !== "booked" && (
          <Badge tone={booking.status === "completed" ? "accent" : "danger"}>
            {t(`status.${booking.status}`)}
            {booking.cancelReason ? ` · ${booking.cancelReason}` : ""}
          </Badge>
        )}
        <dl className="divide-y divide-hairline rounded-lg ring-1 ring-hairline">
          <InfoRow label={t("booking.when")} value={when} />
          <InfoRow label={t("booking.with")} value={`${staff.firstName} ${staff.lastName}`} />
          {booking.resourceId && <InfoRow label={t("booking.room")} value={state.resources.find((r) => r.id === booking.resourceId)?.name ?? ""} />}
          <InfoRow label={t("booking.price")} value={formatMoney(booking.price)} />
          <InfoRow label={t("booking.source")} value={t(`source.${booking.source}`)} />
          {paidByCard > 0 && <InfoRow label={t("giftcards.paidWith")} value={formatMoney(paidByCard)} />}
          {pkg && <InfoRow label={t("packages.on")} value={tc("packages.onLeft", visitsLeft(pkg))} />}
          {customer?.phone && (
            <InfoRow
              label={t("booking.phone")}
              value={
                <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="inline-flex min-h-target min-w-target items-center gap-2 text-action">
                  <Phone size={14} />
                  {customer.phone}
                </a>
              }
            />
          )}
        </dl>
        <FeeDecisionPanel state={state} booking={booking} />
        {moduleEnabled(state.modules, "giftcards") && booking.status === "booked" && remainingForCards(state, booking) > 0 && (
          <div className="space-y-2">
            <Button variant="secondary" width="responsive" icon={<Gift size={18} />} onClick={() => go("giftcard")}>{t("giftcards.pay")}</Button>
            {pkg && <p className="text-sm text-text-secondary">{t("packages.giftCardInstead")}</p>}
          </div>
        )}
        {customer?.note && (
          <div className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-text">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">{t("booking.note")}</p>
            {customer.note}
          </div>
        )}
        {lastJournal && (
          <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("booking.lastAdvice")}</p>
            {lastJournal.advice}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
