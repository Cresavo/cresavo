"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { balanceOf, findGiftCard, paidWithCards, redeemable } from "../../giftcards/cards";
import { t } from "../../i18n";
import { formatMoney } from "../../i18n/format";
import { findCustomer } from "../../selectors";
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Pay a booking with a gift card: type the code, see the balance, pay what the booking still needs. */
export function RedeemSheet({ bookingId, onBack, onClose }: { bookingId: string; onBack: () => void; onClose: () => void }) {
  const { state, today } = useStudio();
  const [code, setCode] = useState("");
  const [lookupId, setLookupId] = useState<string>();
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  const card = findGiftCard(state, code);
  const toPay = booking.price - paidWithCards(state, booking.id);
  const amount = card ? redeemable(state, card, booking) : 0;
  const name = findCustomer(state, booking.customerId)?.firstName ?? "";

  const pay = () => {
    if (!dispatchWithUndoToast({ type: "giftcard/redeem", code, bookingId, date: today }, t("giftcards.paid", { amount: formatMoney(amount) }))) {
      setFailure({ requestId: newActionRequestId(), message: t("payment.failed") });
      return;
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("giftcards.payTitle")}
      description={t("giftcards.payDescription", { name, amount: formatMoney(toPay) })}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>{t("common.back")}</Button>
          <Button disabled={amount <= 0} icon={<Gift size={18} />} onClick={pay}>{t("giftcards.payConfirm", { amount: formatMoney(amount) })}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t("payment.simulated")}</p>
        <Field label={t("giftcards.payCode")}>
          <TextInput value={code} onChange={(event) => {
            const next = event.target.value;
            setCode(next);
            setLookupId(next.trim().length >= 4 ? newActionRequestId() : undefined);
            setFailure(undefined);
          }} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t("giftcards.codeExample")} autoFocus />
        </Field>
        {failure ? <ActionFailure failure={failure} /> : lookupId && (
          card && amount > 0
            ? <p role="status" className="rounded-md bg-action-bg px-3.5 py-3 text-sm font-medium text-text">{t("giftcards.payBalance", { amount: formatMoney(balanceOf(state, card)) })}</p>
            : <ActionFailure failure={{ requestId: lookupId, message: t(card ? "giftcards.payEmpty" : "giftcards.payNotFound") }} />
        )}
      </div>
    </Sheet>
  );
}
