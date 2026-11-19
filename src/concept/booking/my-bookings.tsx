"use client";

import { WithStaff } from "./with-staff";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Info, Repeat, Search } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, relativeDay, formatTime } from "../i18n/format";
import { findCustomer, findService } from "../selectors";
import { usePublicDemo } from "../store";
import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";
import { Button, ButtonLink } from "../ui/button";
import { Card, Section } from "../ui/card";
import { Field, TextInput } from "../ui/controls";
import { EmptyState } from "../ui/empty-state";
import { useSalonNow, type Now } from "../use-now";
import { BookingActions, freeUntilText } from "./booking-actions";
import { hasSettlement } from "./protection";
import { changeRule } from "./policy";
import { ReviewForm } from "./review-form";
import { recallGuest } from "./guest";
import { bookingHome, bookingPage, myBookingsFor, rebookLink } from "./links";
import { customerBookings, findCustomerByPhone } from "./lookup";

/** No login in the demo: the link carries `?ref=`, or the customer types the number they booked with. */
export function MyBookings() {
  const state = usePublicDemo();
  const now = useSalonNow();
  const ref = useSearchParams()?.get("ref");
  const [remembered] = useState(() => state ? recallGuest(state.salon.slug)?.customerId : undefined);
  if (!state) return null;
  const customer = findCustomer(state, ref ?? remembered);
  return customer ? <Overview state={state} now={now} customerId={customer.id} /> : <Lookup state={state} />;
}

function Lookup({ state }: { state: DemoState }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [missing, setMissing] = useState(false);
  const example = state.bookings.find((b) => b.status === "booked" && b.date > state.generatedFor);
  const examplePhone = state.customers.find((c) => c.id === example?.customerId)?.phone;

  return (
    <Card className="mx-auto max-w-md space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("booking.me.lookupTitle")}</h1>
        <p className="mt-1 text-[15px] text-text-secondary">{t("booking.me.lookupHelp")}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const found = findCustomerByPhone(state, phone);
          if (found) router.replace(myBookingsFor(state.salon.slug, found.id));
          else setMissing(true);
        }}
      >
        <Field label={t("booking.yourPhone")}>
          <TextInput value={phone} onChange={(e) => { setPhone(e.target.value); setMissing(false); }} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("booking.phonePlaceholder")} />
        </Field>
        {missing && <Notice tone="danger" role="alert">{t("booking.me.notFound")}</Notice>}
        <Button type="submit" size="lg" className="w-full" icon={<Search size={18} />} disabled={phone.trim().length < 5}>
          {t("booking.me.find")}
        </Button>
      </form>
      {examplePhone && <p className="rounded-md bg-surface-2 px-3.5 py-3 text-sm text-text-secondary">{t("booking.me.demoHint", { phone: examplePhone })}</p>}
    </Card>
  );
}

function Overview({ state, now, customerId }: { state: DemoState; now: Now; customerId: string }) {
  const customer = findCustomer(state, customerId)!;
  const { upcoming, past } = customerBookings(state, customerId, now.today, now.minutes, now.instant);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("booking.me.title", { name: customer.firstName })}</h1>
        <p className="mt-2 flex items-start gap-2 rounded-md bg-action-bg px-3.5 py-3 text-sm text-text">
          <Info size={16} className="mt-0.5 shrink-0" />
          {t("protection.myRules")}
        </p>
      </div>

      <Section title={t("booking.me.upcoming")}>
        {upcoming.length ? (
          <div className="space-y-3">
            {upcoming.map((booking) => (
              <UpcomingCard key={booking.id} state={state} now={now} booking={booking} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarCheck size={22} />}
            title={t("booking.me.noUpcoming")}
            action={<ButtonLink href={`${bookingHome(state.salon.slug)}#book`}>{t("booking.me.bookNow")}</ButtonLink>}
          />
        )}
      </Section>

      {past.length > 0 && (
        <Section title={t("booking.me.past")}>
          <Card className="divide-y divide-hairline">
            {past.map((booking) => {
              const service = findService(state, booking.serviceId);
              return (
                <div key={booking.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{service?.name}</p>
                      <p className="text-sm text-text-secondary">{formatDayLong(booking.date)} · {formatMoney(booking.price)}</p>
                    </div>
                    {hasSettlement(booking) && (
                      <ButtonLink href={bookingPage(state.salon.slug, booking.id)} variant="secondary" size="sm">
                        {t("booking.me.details")}
                      </ButtonLink>
                    )}
                    {state.services.some(s => s.id === booking.serviceId) && (
                      <ButtonLink href={rebookLink(state.salon.slug, booking.serviceId, booking.staffId)} variant="secondary" size="sm" icon={<Repeat size={14} />}>
                        {t("booking.me.rebook")}
                      </ButtonLink>
                    )}
                  </div>
                  <ReviewForm state={state} booking={booking} now={now} />
                </div>
              );
            })}
          </Card>
        </Section>
      )}
    </div>
  );
}

function UpcomingCard({ state, now, booking }: { state: DemoState; now: Now; booking: Booking }) {
  const service = findService(state, booking.serviceId);
  const person = state.staff.find((s) => s.id === booking.staffId);
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{service?.name}</p>
          <p className="mt-0.5 text-[15px]">{formatDayLong(booking.date)}, {formatTime(booking.start)}</p>
          <p className="mt-0.5 text-sm text-text-secondary">
            {person && <WithStaff people={[person]} />} · {formatDuration(booking.duration)} · {formatMoney(booking.price)}
          </p>
        </div>
        <Badge tone="accent">{relativeDay(booking.date, now.today)}</Badge>
      </div>
      <BookingActions state={state} now={now} booking={booking} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
        <span>{changeRule(booking, now.today, now.minutes, now.instant) === "free" ? freeUntilText(booking) : ""}</span>
        <Link href={bookingPage(state.salon.slug, booking.id)} className="font-medium text-action underline-offset-2 hover:underline">{t("booking.me.details")}</Link>
      </div>
    </Card>
  );
}
