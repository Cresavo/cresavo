"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PACKAGE_DEAL, packagePrice } from "../../packages/packages";
import { t } from "../../i18n";
import { formatMoney } from "../../i18n/format";
import { findCustomer, fullName } from "../../selectors";
import { dispatch, undo } from "../../store";
import { Avatar } from "../../ui/avatar";
import { Button } from "../../ui/button";
import { Chip, SearchInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

const MAX_RESULTS = 5;

/** Sell a punch card for one treatment to a customer. */
export function SellPackageSheet({ onClose }: { onClose: () => void }) {
  const { state, today } = useStudio();
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const service = state.services.find((s) => s.id === serviceId);
  const customer = findCustomer(state, customerId);
  const matches = query.trim()
    ? state.customers.filter((c) => fullName(c).toLowerCase().includes(query.trim().toLowerCase())).slice(0, MAX_RESULTS)
    : [];

  const sell = () => {
    if (!service || !customer) return;
    if (dispatch({ type: "package/sell", customerId: customer.id, serviceId: service.id, date: today })) {
      showToast(t("packages.sold", { name: customer.firstName }), { label: t("common.undo"), run: undo });
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("packages.sellTitle")}
      description={t("packages.sellDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!service || !customer} icon={<Check size={18} />} onClick={sell}>{t("packages.sellConfirm")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("packages.treatment")}</p>
          <div className="flex flex-wrap gap-2">
            {state.services.map((s) => (
              <Chip key={s.id} active={serviceId === s.id} onClick={() => setServiceId(s.id)}>{s.name}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("packages.customer")}</p>
          {customer ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
              <Avatar name={fullName(customer)} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{fullName(customer)}</span>
              <Button size="sm" variant="ghost" onClick={() => setCustomerId("")}>{t("common.change")}</Button>
            </div>
          ) : (
            <>
              <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("stock.searchCustomer")} aria-label={t("stock.searchCustomer")} />
              {query.trim() && (
                <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCustomerId(c.id)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
                        <Avatar name={fullName(c)} size="sm" />
                        <span className="truncate">{fullName(c)}</span>
                      </button>
                    </li>
                  ))}
                  {!matches.length && <li className="px-4 py-3 text-sm text-text-secondary">{t("stock.noCustomers")}</li>}
                </ul>
              )}
            </>
          )}
        </div>
        {service && (
          <div className="space-y-1 rounded-lg bg-action-bg px-4 py-3">
            <p className="flex justify-between font-semibold">
              <span>{t("packages.deal", { visits: PACKAGE_DEAL.visits, paid: PACKAGE_DEAL.paidVisits })}</span>
              <span className="tabular-nums">{formatMoney(packagePrice(service))}</span>
            </p>
            <p className="text-sm text-text-secondary">{t("packages.saves", { amount: formatMoney(service.price * PACKAGE_DEAL.visits - packagePrice(service)) })}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
