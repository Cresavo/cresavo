"use client";

import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { balanceOf, findGiftCard } from "../giftcards/cards";
import { formatMoney } from "../i18n/format";
import { GiftCardFace } from "../giftcards/card-face";
import { t } from "../i18n";
import { usePublicDemo } from "../store";
import { Button, ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { bookingHome, giftCardFromParams } from "./links";

/** `/boka/salong-eko/gift?...`: the card a customer shares or prints. Resolve its current balance from the ledger. */
export function GiftCardPage() {
  const state = usePublicDemo();
  const params = useSearchParams();
  const card = params ? giftCardFromParams(params) : null;
  if (!state) return null;
  if (!card) return <Card className="mx-auto max-w-md p-6 text-center text-text-secondary"><h1 className="text-body font-normal">{t("giftcards.pageInvalid")}</h1></Card>;
  const stored = findGiftCard(state, card.code);
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title={t("giftcards.pageTitle", { salon: state.salon.name })} subtitle={t("giftcards.pageText")} />
      <GiftCardFace salonName={state.salon.name} amount={stored?.amount ?? card.amount} recipient={card.recipient} message={card.message} code={card.code} />
      {state.modules.giftcards && <p className="text-h3 font-semibold print:hidden">
        {stored ? t("giftcards.checkResult", { amount: formatMoney(balanceOf(state, stored)) }) : t("giftcards.balanceUnavailable")}
      </p>}
      <div className="flex flex-wrap gap-2 print:hidden">
        <ButtonLink href={`${bookingHome(state.salon.slug)}#book`}>{t("giftcards.pageBook")}</ButtonLink>
        <Button variant="secondary" icon={<Printer size={18} />} onClick={() => window.print()}>{t("giftcards.pagePrint")}</Button>
      </div>
    </div>
  );
}
