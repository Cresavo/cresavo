"use client";

import { ListRow } from "@/concept/ui/list-row";
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
        {cards.length > 0 && (
          <Card className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 bg-action-bg p-5 ring-action/20">
            <div>
              <p className="text-sm font-medium text-text-secondary">{t("giftcards.owed")}</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(giftCardLiability(state))}</p>
            </div>
            <p className="max-w-md text-sm text-text-secondary">{t("giftcards.owedText")}</p>
          </Card>
        )}
        {cards.length ? (
          <Card className="divide-y divide-hairline overflow-hidden">
            {cards.map((card) => (
              <ListRow key={card.id} onClick={() => setSheet({ kind: "card", id: card.id })}
                leading={<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-action-bg"><Gift size={20} aria-hidden /></span>}
                title={t("giftcards.for", { name: card.recipient })}
                meta={<span className="font-mono break-all">{card.code}</span>}
                trailing={<>
                  <span className="shrink-0 text-right text-meta tabular-nums">
                    <span className="block font-medium">{formatMoney(balanceOf(state, card))}</span>
                    <span className="block text-text-secondary">/ {formatMoney(card.amount)}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />
                </>} />
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
