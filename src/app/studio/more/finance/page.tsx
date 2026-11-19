"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { figuresFor } from "@/concept/finance/figures";
import { periodRanges } from "@/concept/finance/periods";
import { totalCosts } from "@/concept/finance/profit";
import { t } from "@/concept/i18n";
import { formatMoney } from "@/concept/i18n/format";
import { AccountantExport } from "@/concept/studio/finance/accountant-export";
import { AccountingSection } from "@/concept/studio/finance/accounting-section";
import { BookingPayments } from "@/concept/studio/finance/booking-payments";
import { AddCost, CostsSection } from "@/concept/studio/finance/costs-section";
import { OverviewSection } from "@/concept/studio/finance/overview-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

export default function FinancePage() {
  const { state, today, minutes } = useStudio();
  const [adding, setAdding] = useState(false);
  const empty = state.industry && !state.costs.length && !state.bookings.length && !state.sales.length && !state.giftCards.length && !state.packages.length;
  const clock = { today, minutes };
  const { current, previous } = periodRanges("month", clock);
  const costs = totalCosts(state.costs);
  const left = figuresFor(state, current, clock).revenue - costs;
  const leftBefore = figuresFor(state, previous, clock).revenue - costs;

  return (
    <MorePage title={t("nav.finance")} module="finance">
      <div className="space-y-8">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-h3 text-text-secondary">{t("finance.leftThisMonth")}</h2>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(left)}</p>
            <p className="mt-1 text-meta text-text-secondary">{t("finance.leftBefore", { amount: formatMoney(leftBefore) })}</p>
          </div>
          <AccountantExport secondary={!!empty} />
        </Card>
        {empty ? (
          adding ? <AddCost primary /> : <EmptyState icon={<Receipt size={22} />} title={t("setup.empty.finance")}
            action={<Button onClick={() => setAdding(true)}>{t("finance.addCost")}</Button>} />
        ) : (
          <>
            <OverviewSection />
            <BookingPayments state={state} />
            <CostsSection />
            <AccountingSection />
          </>
        )}
      </div>
    </MorePage>
  );
}
