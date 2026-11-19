"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { t } from "../../i18n";
import { formatAmount, formatMoney } from "../../i18n/format";
import { sellable } from "../../stock/sales";
import { findCustomer, fullName } from "../../selectors";
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Avatar } from "../../ui/avatar";
import { Button } from "../../ui/button";
import { Chip, SearchInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { Stepper } from "./stepper";
import { dispatchWithUndoToast } from "../log/undo-toast";

const MAX_RESULTS = 5;

/** Mark a product as sold to a customer. No till: it only lowers the stock and shows in revenue and history. */
export function SellSheet({ customerId, onClose }: { customerId?: string; onClose: () => void }) {
  const { state, today } = useStudio();
  const products = sellable(state);
  const [productId, setProductId] = useState(products.find((p) => p.inStock > 0)?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [buyerId, setBuyerId] = useState(customerId ?? "");
  const [query, setQuery] = useState("");
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const product = products.find((p) => p.id === productId);
  const buyer = findCustomer(state, buyerId);
  const matches = query.trim()
    ? state.customers.filter((c) => fullName(c).toLowerCase().includes(query.trim().toLowerCase())).slice(0, MAX_RESULTS)
    : [];
  const canSell = !!product && !!buyer && quantity >= 1 && quantity <= product.inStock;

  const sell = () => {
    if (!product || !buyer) return;
    if (dispatchWithUndoToast({ type: "product/sell", customerId: buyer.id, stockId: product.id, quantity, date: today }, t("stock.sold", { product: product.name, name: buyer.firstName }))) onClose();
    else setFailure({ requestId: newActionRequestId(), message: t("payment.saleFailed") });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("stock.sell")}
      description={t("stock.sellDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!canSell} icon={<Check size={18} />} onClick={sell}>{t("stock.confirmSell")}</Button>
        </>
      }
    >
      {products.length ? (
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">{t("payment.simulated")}</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("stock.product")}</p>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <Chip key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setQuantity(1); }}>{p.name}</Chip>
              ))}
            </div>
            {product && <p className="text-sm text-text-secondary">{formatMoney(product.salePrice ?? 0)} · {t("stock.inStock", { count: formatAmount(product.inStock) })}</p>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("stock.quantity")}</p>
            <Stepper value={quantity} min={1} onChange={setQuantity} lessLabel={t("stock.remove")} moreLabel={t("stock.add")} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("stock.customer")}</p>
            {buyer ? (
              <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
                <Avatar name={fullName(buyer)} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{fullName(buyer)}</span>
                {!customerId && <Button size="sm" variant="ghost" onClick={() => setBuyerId("")}>{t("common.change")}</Button>}
              </div>
            ) : (
              <>
                <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("stock.searchCustomer")} aria-label={t("stock.searchCustomer")} />
                {query.trim() && (
                  <ul className="divide-y divide-hairline rounded-lg ring-1 ring-hairline">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setBuyerId(c.id)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
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
          {product && buyer && (
            <p className="flex justify-between px-1 font-semibold">
              <span>{t("stock.total")}</span>
              <span className="tabular-nums">{formatMoney(quantity * (product.salePrice ?? 0))}</span>
            </p>
          )}
          {failure && <ActionFailure failure={failure} />}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t("stock.noneForSale")}</p>
      )}
    </Sheet>
  );
}
