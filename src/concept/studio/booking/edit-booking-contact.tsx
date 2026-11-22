"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateBooking, type BookingPatch } from "../../customers/rights";
import type { Booking } from "../../data/types";
import { t } from "../../i18n";
import { currentState } from "../../store";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";

/**
 * Correction (GDPR art. 16) of the personal text of one visit: the address typed on the booking page,
 * and the reason of a cancelled visit. `save` commits the change to the salon the sheet shows.
 */
export function EditBookingContact({ booking, save }: { booking: Booking; save: (patch: BookingPatch) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(booking.contactEmail ?? "");
  const [reason, setReason] = useState(booking.cancelReason ?? "");
  const [invalid, setInvalid] = useState(false);
  const hasReason = booking.status === "cancelled" && !!booking.cancelReason;

  const start = () => {
    setEmail(booking.contactEmail ?? "");
    setReason(booking.cancelReason ?? "");
    setInvalid(false);
    setOpen(true);
  };

  const submit = async () => {
    const patch: BookingPatch = {};
    if (email.trim().toLowerCase() !== (booking.contactEmail ?? "")) patch.contactEmail = email.trim() || null;
    if (hasReason && reason.trim() !== booking.cancelReason) patch.cancelReason = reason.trim() || null;
    if (!Object.keys(patch).length) return setOpen(false);
    const state = currentState();
    if (state && updateBooking(state, booking.id, patch) === state) return setInvalid(true);
    if (await save(patch)) setOpen(false);
    else setInvalid(true);
  };

  return (
    <>
      <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={start}>{t("booking.contact.edit")}</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("booking.contact.title")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submit}>{t("common.save")}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("booking.contact.email")} hint={t("booking.contact.emailHint")} error={invalid ? t("booking.contact.invalid") : undefined}>
            <TextInput type="email" value={email} maxLength={254} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {hasReason && (
            <Field label={t("booking.contact.reason")}>
              <TextInput value={reason} maxLength={500} autoComplete="off" onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
        </div>
      </Sheet>
    </>
  );
}
