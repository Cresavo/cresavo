"use client";

import { WithStaff } from "./with-staff";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Info, Search } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatMoney, relativeDay, formatTime } from "../i18n/format";
import { findCustomer, findService } from "../selectors";
import { usePublicDemo } from "../store";
import { newActionRequestId } from "../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../ui/action-failure";
import { Badge } from "../ui/badge";
import { Button, ButtonLink } from "../ui/button";
import { Card, Section } from "../ui/card";
import { Field, TextInput } from "../ui/controls";
import { EmptyState } from "../ui/empty-state";
import { ListRow } from "../ui/list-row";
import { PageHeader } from "../ui/page-header";
import { useSalonNow, type Now } from "../use-now";
import { BookingActions } from "./booking-actions";
import { freeUntilText } from "./deadline-text";
import { changeRule } from "./policy";
import { ReviewForm } from "./review-form";
import { RepeatBookingLink } from "./repeat-booking-link";
import { recallGuest } from "./guest";
import { bookingHome, bookingPage, myBookingsFor } from "./links";
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
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const example = state.bookings.find((b) => b.status === "booked" && b.date > state.generatedFor);
  const examplePhone = state.customers.find((c) => c.id === example?.customerId)?.phone;

  return (
    <Card className="mx-auto max-w-md space-y-5 p-6">
      <PageHeader title={t("booking.me.lookupTitle")} subtitle={t("booking.me.lookupHelp")} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const found = findCustomerByPhone(state, phone);
          if (found) router.replace(myBookingsFor(state.salon.slug, found.id));
          else setFailure({ requestId: newActionRequestId(), reason: "booking.me.notFound" });
        }}
      >
        <Field label={t("booking.yourPhone")}>
          <TextInput value={phone} onChange={(e) => { setPhone(e.target.value); setFailure(undefined); }} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("booking.phonePlaceholder")} />
        </Field>
        {failure && <ActionFailure failure={failure} audience="booking" />}
        <Button type="submit" size="lg" className="w-full" icon={<Search size={18} />} disabled={phone.trim().length < 5}>
          {t("booking.me.find")}
        </Button>
      </form>
      {examplePhone && <p className="rounded-md bg-surface-2 px-4 py-3 text-meta text-text-secondary">{t("booking.me.demoHint", { phone: examplePhone })}</p>}
    </Card>
  );
}

function Overview({ state, now, customerId }: { state: DemoState; now: Now; customerId: string }) {
  const customer = findCustomer(state, customerId)!;
  const { upcoming, past } = customerBookings(state, customerId, now.today, now.minutes, now.instant);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <PageHeader title={t("booking.me.title", { name: customer.firstName })} />
        <p className="mt-2 flex items-start gap-2 rounded-md bg-action-bg px-4 py-3 text-meta text-text">
          <Info size={16} className="mt-1 shrink-0" />
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
                    <ListRow className="flex-1 !px-0" title={service?.name}
                      meta={<>
                        {booking.visitFor && <span className="block font-medium text-text">{t("booking.for.visit", { name: booking.visitFor })}</span>}
                        {formatDayLong(booking.date)} · {formatMoney(booking.price)}
                      </>} />
                    <VisitLinks state={state} booking={booking} />
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
      <ListRow className="!px-0" title={service?.name}
        meta={<>
          {booking.visitFor && <span className="block font-medium text-text">{t("booking.for.visit", { name: booking.visitFor })}</span>}
          <span className="block">{formatDayLong(booking.date)}, {formatTime(booking.start)}</span>
          {person && <WithStaff people={[person]} />} · {formatDuration(booking.duration)} · {formatMoney(booking.price)}
        </>}
        trailing={<Badge tone="accent">{relativeDay(booking.date, now.today)}</Badge>} />
      <VisitLinks state={state} booking={booking} active />
      <BookingActions state={state} now={now} booking={booking} />
      {changeRule(booking, now.today, now.minutes, now.instant) === "free" && <p className="text-meta text-text-secondary">{freeUntilText(booking)}</p>}
    </Card>
  );
}

function VisitLinks({ state, booking, active }: { state: DemoState; booking: Booking; active?: boolean }) {
  const href = bookingPage(state.salon.slug, booking.id);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RepeatBookingLink state={state} booking={booking} variant="secondary" />
      <ButtonLink href={active ? `${href}#manage` : href} variant="secondary">
        {t(active ? "booking.me.details" : "booking.me.pastDetails")}
      </ButtonLink>
    </div>
  );
}
