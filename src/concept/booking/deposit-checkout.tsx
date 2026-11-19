"use client";

import { useEffect, useRef, useState } from "react";
import { depositMethods } from "../connections/ports/payments";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import { currentState, dispatch, withBookingLock } from "../store";
import { salonClock } from "../tools/clock";
import { Button } from "../ui/button";
import { showToast } from "../ui/toast";
import { type CheckoutHold, type DemoMethod } from "./protection";
import { formatMinor, PolicySummary } from "./policy-summary";

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

export function DepositCheckout({ hold, serviceName, onPaid, onRelease }: {
  hold: CheckoutHold; serviceName: string; onPaid: (booking: Booking) => void; onRelease: () => void;
}) {
  const [method, setMethod] = useState<DemoMethod>("card");
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void withBookingLock(() => dispatch({ type: "online/release", id: hold.id }));
      showToast(t("protection.expired"));
    }, Math.max(0, hold.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [hold]);
  const pay = async () => {
    if (pending) return;
    setPending(true);
    const booked = await withBookingLock(() => dispatch({ type: "online/pay", id: hold.id, method }) && currentState()?.bookings.at(-1));
    setPending(false);
    if (booked) onPaid(booked);
    else showToast(t("protection.payFailed"));
  };
  const release = async () => {
    setPending(true);
    const released = await withBookingLock(() => dispatch({ type: "online/release", id: hold.id }));
    setPending(false);
    if (released) onRelease();
    else showToast(t("booking.visitChanged"));
  };
  const expiry = salonClock(new Date(hold.expiresAt));
  return <div className="space-y-4">
    <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{t("protection.checkout")}</h2>
    <p>{serviceName} · {formatDayLong(hold.date)} · {formatTime(hold.start)}</p>
    <p role="status">{t("protection.holdUntil", { time: formatTime(expiry.minutes) })}</p>
    <PolicySummary terms={hold.terms} visit={hold} />
    <fieldset className="flex gap-4"><legend>{t("protection.method")}</legend>
      {depositMethods(hold.terms.depositMinor, hold.terms.currency).map(m =>
        <label key={m} className="inline-flex min-h-11 items-center gap-2">
          <input type="radio" name="deposit-method" checked={method === m} onChange={() => setMethod(m)} /> {t(`protection.${m}`)}
        </label>)}
    </fieldset>
    <Button disabled={pending} onClick={pay}>{t("protection.pay", { amount: formatMinor(hold.terms.depositMinor, hold.terms.currency) })}</Button>
    <Button variant="ghost" disabled={pending} onClick={release}>{t("common.cancel")}</Button>
  </div>;
}
