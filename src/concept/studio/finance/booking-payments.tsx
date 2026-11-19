import { PaymentSummary } from "../../booking/policy-summary";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { formatDate, formatTime } from "../../i18n/format";
import { findService } from "../../selectors";
import { Card, Section } from "../../ui/card";

export function BookingPayments({ state }: { state: DemoState }) {
  const bookings = state.bookings.filter(b => b.protection?.deposit || b.protection?.decision);
  if (!bookings.length) return null;
  return <Section title={t("protection.finance")}><Card><ul className="divide-y divide-hairline">
    {bookings.map(b => <li key={b.id} className="space-y-2 p-4">
      <h3 className="font-semibold">{findService(state, b.serviceId)?.name} · {formatDate(b.date)} · {formatTime(b.start)}</h3>
      <PaymentSummary booking={b} state={state} />
    </li>)}
  </ul></Card></Section>;
}
