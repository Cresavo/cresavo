"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { MAX_AMOUNT, MIN_AMOUNT } from "../../giftcards/cards";
import type { GiftCard } from "../../data/types";
import { t } from "../../i18n";
import { formatMoney } from "../../i18n/format";
import { currentState, dispatchWithLog } from "../../store";
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Button } from "../../ui/button";
import { Chip, Field, TextArea, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { showUndoToast } from "../log/undo-toast";

const PRESETS = [300, 500, 800, 1000];

/** Sell a gift card: amount, who it is for and a message. The sold card opens next, ready to share or print. */
export function SellGiftCardSheet({ onClose, onSold }: { onClose: () => void; onSold: (card: GiftCard) => void }) {
  const { today } = useStudio();
  const [amount, setAmount] = useState(500);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const valid = Number.isInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT && recipient.trim().length > 0;

  const sell = () => {
    const logId = dispatchWithLog({ type: "giftcard/sell", amount, recipient, message, date: today });
    if (logId === false) {
      setFailure({ requestId: newActionRequestId(), message: t("payment.saleFailed") });
      return;
    }
    const card = currentState()!.giftCards.at(-1)!;
    showUndoToast(t("giftcards.sold", { code: card.code }), logId);
    onSold(card);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("giftcards.sellTitle")}
      description={t("giftcards.sellDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} icon={<Check size={18} />} onClick={sell}>{t("giftcards.sellConfirm")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">{t("payment.simulated")}</p>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("giftcards.amount")}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Chip key={preset} active={amount === preset} onClick={() => setAmount(preset)}>{formatMoney(preset)}</Chip>
            ))}
          </div>
          <Field label={t("giftcards.amountOther")} hint={t("giftcards.amountHint", { min: MIN_AMOUNT, max: MAX_AMOUNT })}>
            <TextInput type="number" inputMode="numeric" min={MIN_AMOUNT} max={MAX_AMOUNT} step={50} value={Number.isNaN(amount) ? "" : amount} onChange={(event) => setAmount(event.target.valueAsNumber)} />
          </Field>
        </div>
        <Field label={t("giftcards.recipient")}>
          <TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={t("giftcards.recipientPlaceholder")} maxLength={80} />
        </Field>
        <Field label={t("giftcards.message")}>
          <TextArea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("giftcards.messagePlaceholder")} rows={3} maxLength={280} />
        </Field>
        {failure && <ActionFailure failure={failure} />}
      </div>
    </Sheet>
  );
}
