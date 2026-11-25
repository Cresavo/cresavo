"use client";

import { useState, type ReactNode } from "react";
import { billableVisit, dueOf, settle } from "../../booking/settle";
import { formatMinor } from "../../booking/policy-summary";
import { demoPayments } from "../../connections/demo";
import { swishEligible } from "../../connections/ports/payments";
import { cashChange, type RegisterMethod, type RegisterPayment } from "../../connections/ports/register";
import { t } from "../../i18n";
import { minorFromInput } from "../../register/cash";
import { registerFor, useRegisterReceipts } from "../../register/ledger";
import { findService, findCustomer, visitorName } from "../../selectors";
import { commitAction } from "../../store/commit";
import { Button } from "../../ui/button";
import { Field, Segmented, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showActionFailure } from "../../ui/toast";
import { useCommit } from "../../ui/use-commit";
import { useSalonNow } from "../../use-now";
import { visitTime } from "../../booking/policy";
import { eligibleIncident } from "../../booking/settlement";
import { FeeDecisionPanel } from "../booking/fee-decision";
import { useStudio } from "../use-studio";
import { AmountRow } from "./amount-row";
import { Receipt } from "./receipt";


/**
 * The register for one visit: what is due after the deposit and gift cards,
 * card, Swish or cash, then the receipt. `pendingPanel` is where a payment
 * that waits for the customer (a Swish QR code on their phone) is shown; the
 * register records it as pending until that panel confirms it.
 */
export function RegisterSheet({ bookingId, onBack, onClose, pendingPanel }: {
  bookingId: string;
  onBack: () => void;
  onClose: () => void;
  pendingPanel?: (payment: RegisterPayment) => ReactNode;
}) {
  const { state, today, target } = useStudio();
  const clock = useSalonNow();
  const [run, pending] = useCommit();
  const [method, setMethod] = useState<RegisterMethod>("card");
  const [received, setReceived] = useState("");
  const [waiting, setWaiting] = useState<RegisterPayment>();
  const receipts = useRegisterReceipts(target);
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const register = registerFor(target);
  const visit = billableVisit(state, booking, today);
  const due = dueOf(visit);
  const money = (amount: number) => formatMinor(amount, visit.currency);
  const methods: RegisterMethod[] = swishEligible({ amountMinor: due, currency: visit.currency }) ? ["card", "swish", "cash"] : ["card", "cash"];
  const sale = receipts.filter((r) => r.reference === booking.id && r.kind === "sale").at(-1);
  const refund = sale && receipts.find((r) => r.refundOf === sale.receiptNumber);
  const tendered = method === "cash" ? minorFromInput(received, visit.currency) : null;
  const change = tendered === null ? null : cashChange(due, tendered);
  const ready = method !== "cash" || change !== null;
  const name = visitorName(booking, findCustomer(state, booking.customerId));
  const description = `${name} · ${findService(state, booking.serviceId)?.name ?? ""}`;
  const terms = booking.protection?.terms;
  const showFees = !sale && !!eligibleIncident(booking, clock.instant ?? visitTime({ date: clock.today, start: clock.minutes }).toMillis()) && !!(booking.protection?.deposit || terms?.latePercent || terms?.noShowPercent);

  const take = () => run(async () => {
    const result = await settle(visit, { channel: "in-salon", method, at: new Date().toISOString(), ...(method === "cash" && tendered !== null ? { tenderedMinor: tendered } : {}) }, { payments: demoPayments, register });
    if (!result.ok || result.channel !== "in-salon") return showActionFailure("register.failed");
    if (!result.receipt) return setWaiting(result.payment);
    if (booking.status === "booked" && target) {
      const done = await commitAction(target, { type: "booking/complete", id: booking.id }).catch(() => null);
      if (!done?.ok) showActionFailure("booking.completeFailed");
    }
  });

  const refundSale = () => run(async () => {
    if (!sale) return;
    const result = await register.refund({ receiptId: sale.id, date: today, at: new Date().toISOString(), idempotencyKey: `${sale.id}-refund` });
    if (!result.ok) showActionFailure("register.refundFailed");
  });

  if (sale) {
    return (
      <Sheet open onClose={onClose} title={t("register.title")} description={description}
        footer={<>
          {!refund && <Button variant="secondary" disabled={pending} onClick={refundSale}>{t("register.refund")}</Button>}
          <Button onClick={onClose}>{t("common.close")}</Button>
        </>}>
        <div className="space-y-4">
          <Receipt record={sale} salon={state.salon} />
          {refund && <Receipt record={refund} salon={state.salon} />}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t("register.title")} description={description}
      footer={<>
        <Button variant="ghost" onClick={onBack}>{t("common.back")}</Button>
        <Button disabled={!ready || pending || !!waiting || register.info.kind === "unavailable"} onClick={take}>
          {due ? t("register.pay", { amount: money(due) }) : t("register.payPrepaid")}
        </Button>
      </>}>
      <div className="space-y-5">
        <dl className="divide-y divide-hairline">
          {visit.lines.map((line, i) => <AmountRow key={i} label={line.description} value={money(line.grossMinor)} className="py-3" />)}
          {visit.prepaidMinor > 0 && <AmountRow label={t("register.prepaid")} value={money(-visit.prepaidMinor)} className="py-3" />}
          <AmountRow label={t("register.due")} value={money(due)} strong className="py-3" />
        </dl>
        {due > 0 && (
          <div className="space-y-3">
            <Segmented label={t("register.method")} value={method} onChange={setMethod}
              options={methods.map((value) => ({ value, label: t(`register.${value}`) }))} />
            {method === "cash" && (
              <div className="space-y-3">
                <Field label={t("register.received", { currency: visit.currency })} width="short"
                  error={received && change === null ? t("register.short") : undefined}>
                  <TextInput inputMode="decimal" autoComplete="off" value={received} onChange={(e) => setReceived(e.target.value)} />
                </Field>
                <dl><AmountRow label={t("register.change")} value={change === null ? "–" : money(change)} strong className="py-3" /></dl>
              </div>
            )}
          </div>
        )}
        {waiting && pendingPanel?.(waiting)}
        {showFees && (
          <section className="space-y-3 border-t border-hairline pt-4">
            <h3 className="text-body font-semibold">{t("register.feeTitle")}</h3>
            <FeeDecisionPanel state={state} booking={booking} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
