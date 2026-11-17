"use client";

import { ExternalLink, Link2, Copy } from "lucide-react";
import { giftCardLink } from "../../booking/links";
import { balanceOf } from "../../giftcards/cards";
import { GiftCardFace } from "../../giftcards/card-face";
import { t } from "../../i18n";
import { formatDate, formatMoney } from "../../i18n/format";
import { Button, ButtonLink } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(done);
  } catch {
    showToast(t("giftcards.copyFailed"));
  }
}

/** A sold card as the customer sees it, with ways to hand it over: share link, code, printable page. */
export function GiftCardSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const { state } = useStudio();
  const card = state.giftCards.find((c) => c.id === cardId);
  if (!card) return null;
  const link = giftCardLink(card);

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("giftcards.cardTitle")}
      description={`${t("giftcards.left", { balance: formatMoney(balanceOf(state, card)), amount: formatMoney(card.amount) })} · ${t("giftcards.soldOn", { date: formatDate(card.soldOn) })}`}
    >
      <div className="space-y-5">
        <GiftCardFace salonName={state.salon.name} amount={card.amount} recipient={card.recipient} message={card.message} code={card.code} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="secondary" icon={<Link2 size={18} />} onClick={() => copy(`${window.location.origin}${link}`, t("giftcards.linkCopied"))}>{t("giftcards.copyLink")}</Button>
          <Button variant="secondary" icon={<Copy size={18} />} onClick={() => copy(card.code, t("giftcards.codeCopied"))}>{t("giftcards.copyCode")}</Button>
          <ButtonLink href={link} variant="secondary" icon={<ExternalLink size={18} />} className="sm:col-span-2">{t("giftcards.openCard")}</ButtonLink>
        </div>
      </div>
    </Sheet>
  );
}
