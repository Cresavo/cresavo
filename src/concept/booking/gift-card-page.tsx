"use client";

import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { GiftCardFace } from "../giftcards/card-face";
import { t } from "../i18n";
import { useDemo } from "../store";
import { Button, ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { BOOKING_HOME, giftCardFromParams } from "./links";

/** `/boka/salong-eko/gift?...`: the card a customer shares or prints. It shows what is on the card; the balance is checked on the booking page. */
export function GiftCardPage() {
  const state = useDemo();
  const params = useSearchParams();
  const card = params ? giftCardFromParams(params) : null;
  if (!state) return null;
  if (!card) return <Card className="mx-auto max-w-md p-6 text-center text-eko-muted">{t("giftcards.pageInvalid")}</Card>;
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("giftcards.pageTitle", { salon: state.salon.name })}</h1>
        <p className="mt-2 text-[15px] text-eko-muted">{t("giftcards.pageText")}</p>
      </div>
      <GiftCardFace salonName={state.salon.name} amount={card.amount} recipient={card.recipient} message={card.message} code={card.code} />
      <div className="flex flex-wrap gap-2 print:hidden">
        <ButtonLink href={`${BOOKING_HOME}#book`}>{t("giftcards.pageBook")}</ButtonLink>
        <Button variant="secondary" icon={<Printer size={18} />} onClick={() => window.print()}>{t("giftcards.pagePrint")}</Button>
      </div>
    </div>
  );
}
