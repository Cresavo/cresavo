"use client";

import { useState } from "react";
import type { StockItem } from "../../data/types";
import { t } from "../../i18n";
import { formatAmount } from "../../i18n/format";
import { usesOfProduct } from "../../stock/usage";
import { Button } from "../../ui/button";
import { Field, Select, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";

const toNumber = (text: string) => (text.trim() === "" ? undefined : Math.max(0, Number(text)));

/** Minimum level, supplier and prices of one product, and the treatments that use it. Mount with `key={item.id}`. */
export function ProductSheet({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { state } = useStudio();
  const [minimum, setMinimum] = useState(String(item.reorderAt));
  const [supplier, setSupplier] = useState(item.supplier);
  const [cost, setCost] = useState(String(item.unitCost));
  const [price, setPrice] = useState(item.salePrice === undefined ? "" : String(item.salePrice));
  const uses = usesOfProduct(state, item.id);
  const valid = [toNumber(minimum), toNumber(cost)].every((n) => n !== undefined && Number.isFinite(n)) && (price.trim() === "" || Number.isFinite(toNumber(price)));

  const save = () => {
    dispatchWithUndoToast({
      type: "stock/update",
      id: item.id,
      patch: { reorderAt: toNumber(minimum), unitCost: toNumber(cost), supplier, salePrice: toNumber(price) },
    }, t("stock.saved", { name: item.name }));
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      description={`${item.unit} · ${t("stock.left", { count: formatAmount(item.inStock) })}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("stock.minLevel")} hint={t("stock.minHint")}>
          <TextInput inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </Field>
        <Field label={t("stock.supplier")}>
          <Select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            {state.suppliers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("stock.purchasePrice")}>
            <TextInput inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
          </Field>
          <Field label={t("stock.salePrice")} hint={t("stock.saleHint")}>
            <TextInput inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("stock.usedBy")}</p>
          {uses.length ? (
            <ul className="divide-y divide-hairline rounded-lg ring-1 ring-hairline">
              {uses.map(({ service, quantity }) => (
                <li key={service.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                  <span>{service.name}</span>
                  <span className="tabular-nums text-text-secondary">{t("stock.usedRow", { count: formatAmount(quantity) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{t("stock.usedNone")}</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
