"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { t, tc } from "../../i18n";
import { Button } from "../../ui/button";
import { Tabs } from "../../ui/navigation";
import { MorePage } from "../more/more-page";
import { PackagesPanel } from "../packages/panel";
import { SellPackageSheet } from "../packages/sell-sheet";
import { useStudio } from "../use-studio";
import { GiftCardSheet } from "./card-sheet";
import { GiftCardsPanel } from "./panel";
import { SellGiftCardSheet } from "./sell-sheet";

type PrepaidTab = "giftcards" | "packages";

export function PrepaidPage({ tab: initial = "giftcards" }: { tab?: PrepaidTab }) {
  const { state } = useStudio();
  const [tab, setTab] = useState<PrepaidTab>(initial);
  const [selling, setSelling] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const giftCards = tab === "giftcards";
  const title = t("features.giftcards");

  return (
    <MorePage
      title={title}
      subtitle={giftCards ? tc("giftcards.subtitle", state.giftCards.length) : tc("packages.subtitle", state.packages.length)}
      module="giftcards"
      actions={<Button data-help-id="giftcards.sell" icon={<Plus size={18} />} onClick={() => setSelling(true)}>{t(giftCards ? "giftcards.sell" : "packages.sell")}</Button>}
    >
      <Tabs
        label={title}
        value={tab}
        onChange={(id) => setTab(id as PrepaidTab)}
        tabs={[
          { id: "giftcards", label: t("nav.giftcards"), panel: <GiftCardsPanel onShowCard={setCardId} /> },
          { id: "packages", label: t("nav.packages"), panel: <PackagesPanel /> },
        ]}
      />
      {selling && (giftCards
        ? <SellGiftCardSheet onClose={() => setSelling(false)} onSold={(card) => { setSelling(false); setCardId(card.id); }} />
        : <SellPackageSheet onClose={() => setSelling(false)} />)}
      {cardId && <GiftCardSheet key={cardId} cardId={cardId} onClose={() => setCardId(null)} />}
    </MorePage>
  );
}
