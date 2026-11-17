"use client";

import { useState } from "react";
import { PackageOpen, Plus } from "lucide-react";
import { t, tc } from "@/concept/i18n";
import { formatDate, formatMoney } from "@/concept/i18n/format";
import { PACKAGE_DEAL, packageLiability, visitsLeft } from "@/concept/packages/packages";
import { findCustomer, findService, fullName } from "@/concept/selectors";
import { MorePage } from "@/concept/studio/more/more-page";
import { SellPackageSheet } from "@/concept/studio/packages/sell-sheet";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Badge } from "@/concept/ui/badge";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { Meter } from "@/concept/ui/charts";
import { EmptyState } from "@/concept/ui/empty-state";

export default function PackagesPage() {
  const { state } = useStudio();
  const [selling, setSelling] = useState(false);
  const packages = [...state.packages].reverse();

  return (
    <MorePage
      title={t("nav.packages")}
      subtitle={tc("packages.subtitle", packages.length)}
      module="packages"
      actions={<Button icon={<Plus size={18} />} onClick={() => setSelling(true)}>{t("packages.sell")}</Button>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm font-medium text-action">{t("packages.deal", { visits: PACKAGE_DEAL.visits, paid: PACKAGE_DEAL.paidVisits })}</p>
            <p className="mt-1 text-sm text-text-secondary">{t("packages.dealText")}</p>
          </Card>
          {packages.length > 0 && (
            <Card className="bg-action-bg p-5 ring-action/20">
              <p className="text-sm font-medium text-action">{t("packages.owed")}</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(packageLiability(state))}</p>
              <p className="mt-1 text-sm text-text-secondary">{t("packages.owedText")}</p>
            </Card>
          )}
        </div>
        {packages.length ? (
          <Card className="divide-y divide-border overflow-hidden">
            {packages.map((pkg) => {
              const customer = findCustomer(state, pkg.customerId);
              const left = visitsLeft(pkg);
              return (
                <div key={pkg.id} className="flex min-h-16 items-center gap-4 px-4 py-3">
                  <Avatar name={customer ? fullName(customer) : "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{customer ? fullName(customer) : ""}</p>
                    <p className="truncate text-sm text-text-secondary">{findService(state, pkg.serviceId)?.name}</p>
                    <p className="truncate text-xs text-text-secondary">{t("packages.paid", { amount: formatMoney(pkg.price) })} · {formatDate(pkg.soldOn)}</p>
                    <Meter value={pkg.usedBy.length / pkg.visits} className="mt-2 max-w-48" />
                  </div>
                  <Badge tone={left ? "accent" : "neutral"}>{left ? t("packages.left", { left, total: pkg.visits }) : t("packages.usedUp", { total: pkg.visits })}</Badge>
                </div>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon={<PackageOpen size={22} />} title={t("packages.emptyTitle")} text={t("packages.emptyText")} />
        )}
      </div>
      {selling && <SellPackageSheet onClose={() => setSelling(false)} />}
    </MorePage>
  );
}
