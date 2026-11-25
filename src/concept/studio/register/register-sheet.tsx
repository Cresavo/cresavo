"use client";

import { useRef, useState } from "react";
import { billableVisit, dueOf, settle, settleable } from "../../booking/settle";
import { formatMinor } from "../../booking/policy-summary";
import { RollingAmount } from "../../booking/rolling-amount";
import { demoPayments } from "../../connections/demo";
import { swishEligible } from "../../connections/ports/payments";
import { cashChange, type RegisterMethod } from "../../connections/ports/register";
import { t } from "../../i18n";
import { minorFromInput } from "../../register/cash";
import { cancelPendingPayment, registerFor, usePendingPayment, useRegisterReceipts } from "../../register/ledger";
import { findService, findCustomer, visitorName } from "../../selectors";
import { commitAction } from "../../store/commit";
import { Button } from "../../ui/button";
import { Field, Segmented, TextInput } from "../../ui/controls";
import { SuccessCheck } from "../../ui/feedback";
import { Sheet } from "../../ui/sheet";
import { showActionFailure } from "../../ui/toast";
import { useCommit } from "../../ui/use-commit";
import { useSalonNow } from "../../use-now";
import { visitTime } from "../../booking/policy";
import { eligibleIncident } from "../../booking/settlement";
import { FeeDecisionPanel } from "../booking/fee-decision";
import { useStudio } from "../use-studio";
import { AmountRow } from "./amount-row";
import { PhonePayPanel } from "./phone-pay-panel";
import { Receipt } from "./receipt";

/** What the counter can choose: a method the register takes itself, or the customer's own phone. */
type Choice = RegisterMethod | "phone";
/** One payment attempt: kept for a retry of the same payment, replaced once a phone payment is cancelled or the input changes. */
interface Attempt {
  id: string;
  at: string;
}

/**
 * The register for one visit: what is due after the deposit and gift cards,
 * card, Swish or cash, then the receipt. "Phone / QR" lets the customer pay
 * on their own phone: the register records the payment as pending, shows a QR
 * code and confirms it with the method the customer chose there.
 */
export function RegisterSheet({ bookingId, onBack, onClose }: {
  bookingId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const { state, today, target } = useStudio();
  const clock = useSalonNow();
  const [run, pending] = useCommit();
  const [method, setMethod] = useState<Choice>("card");
  const [received, setReceived] = useState("");
  const attempt = useRef<Attempt | null>(null);
  const receipts = useRegisterReceipts(target);
  const waiting = usePendingPayment(target, bookingId);
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const register = registerFor(target);
  const visit = billableVisit(state, booking, today);
  const due = dueOf(visit);
  const money = (amount: number) => formatMinor(amount, visit.currency);
  const rolling = (amount: number) => <RollingAmount minor={amount} currency={visit.currency} />;
  const swish = swishEligible({ amountMinor: due, currency: visit.currency });
  // The payment page knows the sample business only, so a visitor's own trial salon takes payment at the counter.
  const methods: Choice[] = [...(swish ? ["card", "swish", "cash"] as const : ["card", "cash"] as const), ...(target?.workspace === "demo" ? ["phone"] as const : [])];
  const sale = receipts.filter((r) => r.reference === booking.id && r.kind === "sale").at(-1);
  const refund = sale && receipts.find((r) => r.refundOf === sale.receiptNumber);
  const tendered = method === "cash" ? minorFromInput(received, visit.currency) : null;
  const change = tendered === null ? null : cashChange(due, tendered);
  const ready = method !== "cash" || change !== null;
  const name = visitorName(booking, findCustomer(state, booking.customerId));
  const description = `${name} · ${findService(state, booking.serviceId)?.name ?? ""}`;
  const terms = booking.protection?.terms;
  // A fee decision closes the visit: the register has nothing left to take for it.
  const takes = settleable(booking);
  const feeDue = !!eligibleIncident(booking, clock.instant ?? visitTime({ date: clock.today, start: clock.minutes }).toMillis()) && !!(booking.protection?.deposit || terms?.latePercent || terms?.noShowPercent);
  // The fee section stays after a decision, so the register shows what closed the visit.
  const showFees = !sale && (feeDue || !!booking.protection?.decision);

  const finishVisit = async () => {
    if (booking.status === "booked" && target) {
      const done = await commitAction(target, { type: "booking/complete", id: booking.id }).catch(() => null);
      if (!done?.ok) showActionFailure("booking.completeFailed");
    }
  };

  const take = () => run(async () => {
    if (!settleable(booking)) return showActionFailure("register.closed");
    const { id, at } = (attempt.current ??= { id: crypto.randomUUID(), at: new Date().toISOString() });
    // The customer chooses card or Swish on their phone; the pending payment starts as card and is confirmed with their choice.
    const intent = method === "phone"
      ? { channel: "in-salon" as const, method: "card" as const, pending: true, attempt: id, at }
      : { channel: "in-salon" as const, method, attempt: id, at, ...(method === "cash" && tendered !== null ? { tenderedMinor: tendered } : {}) };
    const result = await settle(visit, intent, { payments: demoPayments, register });
    if (!result.ok || result.channel !== "in-salon") return showActionFailure("register.failed");
    if (result.receipt) await finishVisit();
  });

  const confirmPhone = async (chosen: Exclude<RegisterMethod, "cash">) => {
    if (!waiting) return;
    if (!settleable(booking)) {
      await cancelPendingPayment(target, booking.id);
      return showActionFailure("register.closed");
    }
    const result = await register.completePayment({ paymentId: waiting.id, outcome: "paid", method: chosen, at: new Date().toISOString() });
    if (!result.ok) return showActionFailure("register.failed");
    await finishVisit();
  };

  const cancelPhone = () => run(async () => {
    if (!waiting) return;
    const result = await register.completePayment({ paymentId: waiting.id, outcome: "failed", at: new Date().toISOString() });
    if (!result.ok) return showActionFailure("register.failed");
    // The next payment is a new attempt, with its own key and time.
    attempt.current = null;
  });
  const choose = (next: Choice) => {
    attempt.current = null;
    setMethod(next);
  };
  const receive = (value: string) => {
    attempt.current = null;
    setReceived(value);
  };

  const refundSale = () => run(async () => {
    if (!sale) return;
    const result = await register.refund({ receiptId: sale.id, date: today, at: new Date().toISOString(), idempotencyKey: `${sale.id}-refund` });
    if (!result.ok) showActionFailure("register.refundFailed");
  });

  if (sale) {
    return (
      <Sheet open onClose={onClose} title={t("register.title")} description={description}
        footer={<>
          {!refund && sale.paidMinor > 0 && (
            <Button variant="secondary" width="responsive" disabled={pending} onClick={refundSale}>
              {t("register.refundTaken", { amount: money(sale.paidMinor), method: t(`register.${sale.method}`) })}
            </Button>
          )}
          <Button width="responsive" onClick={onClose}>{t("common.close")}</Button>
        </>}>
        <div className="space-y-4">
          {!refund && <p className="ui-arrive flex items-center gap-2 font-medium"><SuccessCheck />{t("pay.paid.title")}</p>}
          <Receipt record={sale} salon={state.salon} />
          {refund && <Receipt record={refund} salon={state.salon} />}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t("register.title")} description={description}
      footer={<>
        {waiting ? <Button variant="ghost" width="responsive" disabled={pending} onClick={cancelPhone}>{t("register.phoneCancel")}</Button> : <>
          <Button variant="ghost" width="responsive" onClick={onBack}>{t("common.back")}</Button>
          {takes && <Button width="responsive" disabled={!ready || pending || register.info.kind === "unavailable"} onClick={take}>
            {!due ? t("register.payPrepaid") : method === "phone" ? t("register.phoneShow") : t("register.pay", { amount: money(due) })}
          </Button>}
        </>}
      </>}>
      <div className="space-y-5">
        {takes && <dl className="divide-y divide-hairline">
          {visit.lines.map((line, i) => <AmountRow key={i} label={line.description} value={money(line.grossMinor)} className="py-3" />)}
          {visit.prepaidMinor > 0 && <AmountRow label={t("register.prepaid")} value={rolling(-visit.prepaidMinor)} className="py-3" />}
          <AmountRow label={t("register.due")} value={rolling(due)} strong className="py-3" />
        </dl>}
        {!takes && <p className="text-text-secondary">{t("register.closedText")}</p>}
        {takes && due > 0 && !waiting && (
          <div className="space-y-3">
            <Segmented label={t("register.method")} value={method} onChange={choose} fit={methods.length > 3}
              options={methods.map((value) => ({ value, label: t(`register.${value}`) }))} />
            {method === "cash" && (
              <div className="ui-arrive space-y-3">
                <Field label={t("register.received", { currency: visit.currency })} width="short"
                  error={received && change === null ? t("register.short") : undefined}>
                  <TextInput inputMode="decimal" autoComplete="off" value={received} onChange={(e) => receive(e.target.value)} />
                </Field>
                <dl><AmountRow label={t("register.change")} value={change === null ? "–" : rolling(change)} strong className="py-3" /></dl>
              </div>
            )}
          </div>
        )}
        {takes && waiting && target && (
          <PhonePayPanel key={waiting.id} paymentId={waiting.id} business={state.salon.slug} workspace={target.workspace}
            amountMinor={due} amount={money(due)} currency={visit.currency} methods={swish ? ["card", "swish"] : ["card"]} onPaid={confirmPhone} />
        )}
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
