"use client";

import { t } from "@/concept/i18n";
import { MorePage } from "@/concept/studio/more/more-page";
import { AccountingSection } from "@/concept/studio/finance/accounting-section";
import { CostsSection } from "@/concept/studio/finance/costs-section";
import { OverviewSection } from "@/concept/studio/finance/overview-section";

export default function FinancePage() {
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
