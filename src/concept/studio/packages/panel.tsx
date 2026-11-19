"use client";

import { PackageOpen } from "lucide-react";
import { t } from "@/concept/i18n";
import { formatDate, formatMoney } from "@/concept/i18n/format";
import { PACKAGE_DEAL, packageLiability, visitsLeft } from "@/concept/packages/packages";
import { findCustomer, findService, fullName } from "@/concept/selectors";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Badge } from "@/concept/ui/badge";
import { Card } from "@/concept/ui/card";
import { ListRow } from "@/concept/ui/list-row";
import { Meter } from "@/concept/ui/charts";
import { EmptyState } from "@/concept/ui/empty-state";

export function PackagesPanel() {
  const { state } = useStudio();
  const packages = [...state.packages].reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-action">{t("packages.deal", { visits: PACKAGE_DEAL.visits, paid: PACKAGE_DEAL.paidVisits })}</p>
          <p className="mt-1 text-sm text-text-secondary">{t("packages.dealText")}</p>
        </Card>
        {packages.length > 0 && (
          <Card className="bg-action-bg p-5 ring-action/20">
            <p className="text-sm font-medium text-text-secondary">{t("packages.owed")}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(packageLiability(state))}</p>
            <p className="mt-1 text-sm text-text-secondary">{t("packages.owedText")}</p>
          </Card>
        )}
      </div>
      {packages.length ? (
        <Card className="divide-y divide-hairline overflow-hidden">
          {packages.map((pkg) => {
            const customer = findCustomer(state, pkg.customerId);
            const left = visitsLeft(pkg);
            return (
              <ListRow key={pkg.id} leading={<Avatar name={customer ? fullName(customer) : "?"} size="sm" />}
                title={customer ? fullName(customer) : ""}
                meta={<>
                  <span className="block">{findService(state, pkg.serviceId)?.name}</span>
                  <span className="block">{t("packages.paid", { amount: formatMoney(pkg.price) })} · {formatDate(pkg.soldOn)}</span>
                  <Meter value={pkg.usedBy.length / pkg.visits} className="mt-2 max-w-48" />
                </>}
                trailing={<Badge tone={left ? "accent" : "neutral"}>{left ? t("packages.left", { left, total: pkg.visits }) : t("packages.usedUp", { total: pkg.visits })}</Badge>} />
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={<PackageOpen size={22} />} title={t("packages.emptyTitle")} text={t("packages.emptyText")} />
      )}
    </div>
  );
}
