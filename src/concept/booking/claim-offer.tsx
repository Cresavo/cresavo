"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatMoney, formatTime } from "../i18n/format";
import { currentState, dispatch, withBookingLock } from "../store";
import { salonClock } from "../tools/clock";
import { Button, ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { showActionFailure } from "../ui/toast";
import type { Now } from "../use-now";
import { DepositCheckout } from "./deposit-checkout";
import { bookingPage } from "./links";
import { isNewBookingCustomer } from "./lookup";
import { PolicySummary } from "./policy-summary";
import { quote } from "./protection";

/**
 * `/boka/<slug>?offer=<id>`: the personal link in a waitlist text, on the
 * salon's own page. Opening it changes nothing; booking rechecks the time
 * under the booking lock, and a deposit goes through the usual checkout
 * with the offer's own deadline.
 */
export function ClaimOffer({ state, now, id }: { state: DemoState; now: Now; id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(false);
  const offer = state.waitlistOffers.find((o) => o.id === id);
  const service = state.services.find((s) => s.id === offer?.serviceId);
  const person = state.staff.find((p) => p.id === offer?.staffId);
  const phone = state.customers.find((c) => c.id === offer?.customerId)?.phone ?? "";
  const hold = state.checkoutHolds.find((h) => h.offerId === id);
  const active = offer?.status === "offered" && !!service;
  const waiting = !left && state.waitlistEntries.some((e) => e.customerId === offer?.customerId);

  const act = async (type: "online/claim" | "online/decline" | "online/leave") => {
    if (!offer || !service || pending) return;
    setPending(true);
    const notice = {
      title: t("booking.inboxTitle"),
      body: t("booking.inboxBody", { service: service.name, staff: person?.firstName ?? "", day: formatDayLong(offer.date), time: formatTime(offer.start) }),
    };
    const done = await withBookingLock(() => dispatch(
      type === "online/claim" ? { type, id, termsVersion: state.cancellationPolicy.version, notice }
        : type === "online/leave" ? { type, id, all: true } : { type, id },
    )).catch(() => false);
    setPending(false);
    if (!done) return showActionFailure("booking.visitChanged", undefined, "booking");
    if (type === "online/leave") setLeft(true);
    const booked = currentState()?.waitlistOffers.find((o) => o.id === id)?.bookingId;
    if (type === "online/claim" && booked) router.push(bookingPage(state.salon.slug, booked));
  };

  const leave = waiting && <Button variant="tertiary" disabled={pending} onClick={() => act("online/leave")}>{t("offers.leave")}</Button>;

  if (active && hold) {
    return (
      <Card className="mx-auto max-w-lg space-y-4 p-5">
        <DepositCheckout hold={hold} serviceName={service.name} now={now} phone={phone} packagesEnabled={false}
          onPaid={(booking) => router.push(bookingPage(state.salon.slug, booking.id))} onRelease={() => undefined} />
        {leave}
      </Card>
    );
  }
  return (
    <Card className="mx-auto max-w-lg space-y-4 p-5">
      <h1 className="text-h2 font-semibold">{t("offers.claimTitle")}</h1>
      {active ? (
        <>
          <div className="space-y-1 text-body">
            <p className="font-medium">{service.name}{person ? ` · ${person.firstName}` : ""} · {formatMoney(service.price)}</p>
            <p>{formatDayLong(offer.date)} · {formatTime(offer.start)}</p>
            <p role="status" className="text-meta text-text-secondary">{t("offers.until", { time: formatTime(salonClock(new Date(offer.expiresAt)).minutes) })}</p>
          </div>
          <PolicySummary terms={quote(state.cancellationPolicy, service, state.localization.currency, isNewBookingCustomer(state, phone))} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => act("online/claim")}>{t("offers.claim")}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => act("online/decline")}>{t("offers.decline")}</Button>
          </div>
        </>
      ) : (
        <p role="status" className="text-body">{t(left ? "offers.leftDone" : offer?.status === "claimed" ? "offers.claimedDone" : "offers.inactive")}</p>
      )}
      {offer?.bookingId && <ButtonLink variant="secondary" href={bookingPage(state.salon.slug, offer.bookingId)}>{t("booking.me.details")}</ButtonLink>}
      {leave}
    </Card>
  );
}
