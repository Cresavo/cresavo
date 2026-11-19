"use client";

import { ListRow } from "@/concept/ui/list-row";
import { ChevronRight, Gift } from "lucide-react";
import { balanceOf, giftCardLiability } from "@/concept/giftcards/cards";
import { t } from "@/concept/i18n";
import { formatMoney } from "@/concept/i18n/format";
import { useStudio } from "@/concept/studio/use-studio";
import { Card } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

export function GiftCardsPanel({ onShowCard }: { onShowCard: (id: string) => void }) {
  const { state } = useStudio();
  const cards = [...state.giftCards].reverse();

  return (
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
            <ListRow key={card.id} onClick={() => onShowCard(card.id)}
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
  );
}
