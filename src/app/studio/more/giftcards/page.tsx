"use client";

import { useState } from "react";
import { ChevronRight, Gift, Plus } from "lucide-react";
import { balanceOf, giftCardLiability } from "@/concept/giftcards/cards";
import { t, tc } from "@/concept/i18n";
import { formatMoney } from "@/concept/i18n/format";
import { GiftCardSheet } from "@/concept/studio/giftcards/card-sheet";
import { SellGiftCardSheet } from "@/concept/studio/giftcards/sell-sheet";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

type Sheet = { kind: "sell" } | { kind: "card"; id: string } | null;

export default function GiftCardsPage() {
  const { state } = useStudio();
  const [sheet, setSheet] = useState<Sheet>(null);
  const cards = [...state.giftCards].reverse();

  return (
    <MorePage
      title={t("nav.giftcards")}
      subtitle={tc("giftcards.subtitle", cards.length)}
      module="giftcards"
      actions={<Button icon={<Plus size={18} />} onClick={() => setSheet({ kind: "sell" })}>{t("giftcards.sell")}</Button>}
    >
      <div className="space-y-6">
        <Card className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 bg-eko-accent-soft p-5 ring-eko-accent/20">
          <div>
            <p className="text-sm font-medium text-eko-accent">{t("giftcards.owed")}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(giftCardLiability(state))}</p>
          </div>
          <p className="max-w-md text-sm text-eko-muted">{t("giftcards.owedText")}</p>
        </Card>
        {cards.length ? (
          <Card className="divide-y divide-eko-line overflow-hidden">
            {cards.map((card) => (
              <button key={card.id} type="button" onClick={() => setSheet({ kind: "card", id: card.id })} className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left hover:bg-eko-sunken">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent"><Gift size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t("giftcards.for", { name: card.recipient })}</span>
                  <span className="block truncate font-mono text-sm text-eko-muted">{card.code}</span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="block font-medium">{formatMoney(balanceOf(state, card))}</span>
                  <span className="block text-eko-muted">/ {formatMoney(card.amount)}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-eko-muted" />
              </button>
            ))}
          </Card>
        ) : (
          <EmptyState icon={<Gift size={22} />} title={t("giftcards.emptyTitle")} text={t("giftcards.emptyText")} />
        )}
      </div>
      {sheet?.kind === "sell" && <SellGiftCardSheet onClose={() => setSheet(null)} onSold={(card) => setSheet({ kind: "card", id: card.id })} />}
      {sheet?.kind === "card" && <GiftCardSheet key={sheet.id} cardId={sheet.id} onClose={() => setSheet(null)} />}
    </MorePage>
  );
}
