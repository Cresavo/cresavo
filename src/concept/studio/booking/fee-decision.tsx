"use client";

import { useState } from "react";
import { currentRole, useRole } from "../../ops/role";
import { eligibleIncident } from "../../booking/settlement";
import { formatMinor, PaymentSummary } from "../../booking/policy-summary";
import { feeMinor, settleFee, termsOf } from "../../booking/protection";
import type { Booking, DemoState } from "../../data/types";
import { locale, t } from "../../i18n";
import { dispatchWithLog, withBookingLock } from "../../store";
import { SALON_TIMEZONE } from "../../tools/clock";
import { DemoBadge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { showActionFailure } from "../../ui/toast";
import { useSalonNow } from "../../use-now";
import { visitTime } from "../../booking/policy";

export function FeeDecisionPanel({ state, booking }: { state: DemoState; booking: Booking }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const role = useRole();
  const clock = useSalonNow();
  const incident = eligibleIncident(booking, clock.instant ?? visitTime({ date: clock.today, start: clock.minutes }).toMillis());
  const terms = termsOf(booking, state);
  const fee = incident ? feeMinor(terms, incident) : 0;
  const decision = booking.protection?.decision;
  const money = (amount: number) => formatMinor(amount, terms.currency);
  const settlement = settleFee(booking.protection?.deposit ? terms.depositMinor : 0, fee);
  const decide = async (outcome: "charge" | "waive") => {
    if (!incident || pending) return;
    setPending(true);
    const ok = await withBookingLock(() => dispatchWithLog({
      type: "booking/fee", id: booking.id, incident, outcome, reason,
    }, undefined, latest => {
      const current = latest.bookings.find(b => b.id === booking.id);
      return currentRole() === "owner" && current?.date === booking.date && current.start === booking.start && current.staffId === booking.staffId;
    })).catch(() => false as const);
    setPending(false);
    if (ok === false) showActionFailure("booking.visitChanged");
  };
  return <div className="space-y-3">
    <PaymentSummary state={state} booking={booking} />
    {decision && <p className="text-sm">{t("protection.record", {
      incident: t(decision.incident === "noshow" ? "status.noshow" : "protection.late"),
      actor: t("protection.owner"), time: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: SALON_TIMEZONE }).format(decision.at),
      fee: money(decision.proposedMinor),
    })} {decision.reason}</p>}
    {role === "owner" && incident && (open ? <div className="space-y-3 rounded-md bg-surface-2 p-4">
      <h3 className="font-semibold">{t(incident === "noshow" ? "status.noshow" : "protection.late")}</h3>
      <p>{t("protection.proposal", { fee: money(fee), extra: money(settlement.additional), refund: money(settlement.refund) })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge short />
        <p className="text-meta">{t("protection.simulated")}</p>
      </div>
      <Button variant={booking.status === "booked" ? "secondary" : "primary"} disabled={pending} onClick={() => decide("charge")}>{t("protection.charge")}</Button>
      <Field label={t("protection.reason")}><TextInput maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Button variant="secondary" disabled={!reason.trim() || pending} onClick={() => decide("waive")}>{t("protection.waive")}</Button>
    </div> : <Button variant="secondary" onClick={() => setOpen(true)}>{t(incident === "noshow" ? "protection.markMissed" : "protection.markLate")}</Button>)}
  </div>;
}
