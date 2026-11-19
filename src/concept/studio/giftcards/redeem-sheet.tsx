"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { balanceOf, findGiftCard, paidWithCards, redeemable } from "../../giftcards/cards";
import { t } from "../../i18n";
import { formatMoney } from "../../i18n/format";
import { findCustomer } from "../../selectors";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Pay a booking with a gift card: type the code, see the balance, pay what the booking still needs. */
export function RedeemSheet({ bookingId, onBack, onClose }: { bookingId: string; onBack: () => void; onClose: () => void }) {
  const { state, today } = useStudio();
  const [code, setCode] = useState("");
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  const card = findGiftCard(state, code);
  const toPay = booking.price - paidWithCards(state, booking.id);
  const amount = card ? redeemable(state, card, booking) : 0;
  const name = findCustomer(state, booking.customerId)?.firstName ?? "";

  const pay = () => {
    if (!dispatchWithUndoToast({ type: "giftcard/redeem", code, bookingId, date: today }, t("giftcards.paid", { amount: formatMoney(amount) }))) return;
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
        <Field label={t("giftcards.payCode")}>
          <TextInput value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t("giftcards.codeExample")} autoFocus />
        </Field>
        {code.trim().length >= 4 && (
          <p role="status" className={card && amount > 0 ? "rounded-md bg-action-bg px-3.5 py-3 text-sm font-medium text-text" : "text-sm text-danger"}>
            {!card ? t("giftcards.payNotFound") : amount > 0 ? t("giftcards.payBalance", { amount: formatMoney(balanceOf(state, card)) }) : t("giftcards.payEmpty")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
