"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { useStudio } from "@/concept/studio/use-studio";
import { EmptyState } from "@/concept/ui/empty-state";
import { Button } from "@/concept/ui/button";
import { t } from "@/concept/i18n";
import { MorePage } from "@/concept/studio/more/more-page";
import { AccountingSection } from "@/concept/studio/finance/accounting-section";
import { AddCost, CostsSection } from "@/concept/studio/finance/costs-section";
import { OverviewSection } from "@/concept/studio/finance/overview-section";

export default function FinancePage() {
  const { state } = useStudio();
  const [adding, setAdding] = useState(false);
  if (state.industry && !state.costs.length && !state.bookings.length && !state.sales.length && !state.giftCards.length && !state.packages.length) {
    return <MorePage title={t("nav.finance")} module="finance">
      {adding ? <AddCost /> : <EmptyState icon={<Receipt size={22} />} title={t("setup.empty.finance")}
        action={<Button onClick={() => setAdding(true)}>{t("finance.addCost")}</Button>} />}
    </MorePage>;
  }
  return (
    <MorePage title={t("nav.finance")} subtitle={t("finance.subtitle")} module="finance">
      <div className="space-y-8">
        <OverviewSection />
        <CostsSection />
        <AccountingSection />
      </div>
    </MorePage>
  );
}
