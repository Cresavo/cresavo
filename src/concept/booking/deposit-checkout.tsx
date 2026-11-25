"use client";

import { useEffect, useRef, useState } from "react";
import { commitAction, type Target } from "../store/commit";
import { depositMethods } from "../connections/ports/payments";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import { salonClock } from "../tools/clock";
import { Button } from "../ui/button";
import { Input } from "../ui/controls";
import { useCommit } from "../ui/use-commit";
import { showActionFailure } from "../ui/toast";
import { type CheckoutHold, type DemoMethod } from "./protection";
import type { Now } from "../use-now";
import { BookingSummary } from "./booking-summary";
import { formatMinor } from "./policy-summary";

/** Legacy references have no consent flag. Contact details stay on the hold. */
export function checkoutReference(hold: CheckoutHold, remember: boolean) {
  return `${hold.id}/${hold.expiresAt}${remember ? "/remember" : ""}`;
}

export function resumeCheckout(holds: CheckoutHold[], reference: string | null) {
  const remember = reference?.endsWith("/remember") === true;
  const hold = holds.find(h => checkoutReference(h, remember) === reference);
  return { hold, remember: !!hold && remember };
}
export function useCheckoutHold(state: DemoState) {
  const key = `booking-checkout:${state.salon.slug}`;
  const [reference, setReference] = useState(() => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  });
  function selectHold(next?: CheckoutHold, remember = false) {
    const value = next ? checkoutReference(next, remember) : null;
    setReference(value);
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch { /* In-memory checkout works in an embedded widget. */ }
  }
  return { ...resumeCheckout(state.checkoutHolds, reference), selectHold };
}

/** Saves a change to the hold's salon; false for any refusal (the hold ended, the salon was replaced). */
async function commitHold(target: Target | null, action: Parameters<typeof commitAction>[1]) {
  const result = target && await commitAction(target, action).catch(() => null);
  return result?.ok ? result : null;
}

export function DepositCheckout({ target, hold, serviceName, now, phone, packagesEnabled, onPaid, onRelease }: {
  /** The salon the hold was made in, from the state the page rendered. */
  target: Target | null;
  now: Now; phone: string; packagesEnabled: boolean;
  hold: CheckoutHold; serviceName: string; onPaid: (booking: Booking) => void; onRelease: () => void;
}) {
  const [method, setMethod] = useState<DemoMethod>("card");
  const [run, pending] = useCommit();
  const [paying, setPaying] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const released = await commitHold(target, { type: "online/release", id: hold.id });
      showActionFailure(released ? "protection.expired" : "booking.visitChanged", undefined, "booking");
    }, Math.max(0, hold.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [hold, target]);
  const pay = () => run(async () => {
    setPaying(true);
    const paid = await commitHold(target, { type: "online/pay", id: hold.id, method });
    setPaying(false);
    // The saved state is this payment's: its newest booking is the one the hold became.
    const booked = paid?.state.bookings.at(-1);
    if (booked) onPaid(booked);
    else showActionFailure("protection.payFailed", undefined, "booking");
  });
  const release = () => run(async () => {
    if (await commitHold(target, { type: "online/release", id: hold.id })) onRelease();
    else showActionFailure("booking.visitChanged", undefined, "booking");
  });
  const expiry = salonClock(new Date(hold.expiresAt));
  return <div className="space-y-4">
    <h2 ref={heading} tabIndex={-1} className="text-h2 font-semibold">{t("protection.checkout")}</h2>
    <div className="booking-checkout">
      <div className="space-y-2">
        <p className="text-body">{serviceName} · {formatDayLong(hold.date)} · {formatTime(hold.start)}</p>
        <p role="status" className="text-meta text-text-secondary">{t("protection.holdUntil", { time: formatTime(expiry.minutes) })}</p>
      </div>
      <BookingSummary slot={hold} terms={hold.terms} now={now} phone={phone} packagesEnabled={packagesEnabled} />
      <div className="space-y-4">
        <fieldset className="space-y-1">
          <legend className="text-body font-medium">{t("protection.method")}</legend>
          <div className="flex flex-wrap gap-4">
            {depositMethods(hold.terms.depositMinor, hold.terms.currency).map(m =>
              <label key={m} className="inline-flex min-h-target min-w-target cursor-pointer items-center gap-2 text-body">
                <Input type="radio" name="deposit-method" checked={method === m} onChange={() => setMethod(m)} /> {t(`protection.${m}`)}
              </label>)}
          </div>
        </fieldset>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} loading={paying} onClick={pay}>{t("protection.pay", { amount: formatMinor(hold.terms.depositMinor, hold.terms.currency) })}</Button>
            <Button variant="tertiary" disabled={pending} onClick={release}>{t("common.cancel")}</Button>
          </div>
          <p role="status" className="min-h-[1lh] text-meta text-text-secondary">{paying && t("pay.confirming")}</p>
        </div>
      </div>
    </div>
  </div>;
}
