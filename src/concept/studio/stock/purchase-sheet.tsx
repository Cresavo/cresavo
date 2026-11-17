"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { t, tc } from "../../i18n";
import { formatMoney } from "../../i18n/format";
import { buildOrders, groupBySupplier, purchaseList } from "../../stock/purchase";
import { supplierOf } from "../../stock/forecast";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { Stepper } from "./stepper";

/** The purchase list: what is low, a proposed amount each, one tap to approve and send (simulated). */
export function PurchaseSheet({ onClose }: { onClose: () => void }) {
  const { state, today, minutes } = useStudio();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const lines = purchaseList(state, today).map((l) => ({ ...l, quantity: edits[l.item.id] ?? l.quantity }));
  const groups = groupBySupplier(lines);
  const total = groups.reduce((sum, g) => sum + g.total, 0);

  const approve = () => {
    const orders = buildOrders(state, lines, today);
    dispatch({ type: "stock/order", orders, at: { date: today, time: minutes } });
    showToast(t("stock.ordered", { suppliers: orders.map((o) => o.supplier).join(", ") }), { label: t("common.undo"), run: undo });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("stock.listTitle")}
      description={t("stock.listDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!lines.some((l) => l.quantity > 0)} icon={<Mail size={18} />} onClick={approve}>{t("stock.approve")}</Button>
        </>
      }
    >
      {lines.length ? (
        <div className="space-y-5">
          {groups.map((group) => {
            const lead = supplierOf(state, group.lines[0].item)?.leadDays ?? 0;
            return (
              <section key={group.supplier} className="space-y-2">
                <p className="flex items-baseline justify-between gap-3 px-1 text-sm">
                  <span className="font-semibold">{group.supplier}</span>
                  <span className="text-eko-muted">{tc("stock.delivery", lead)}</span>
                </p>
                <ul className="divide-y divide-eko-line rounded-2xl ring-1 ring-eko-line">
                  {group.lines.map(({ item, quantity }) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">{item.name}</span>
                        <span className="block text-eko-muted">{item.unit} · {formatMoney(quantity * item.unitCost)}</span>
                      </span>
                      <Stepper
                        value={quantity}
                        onChange={(value) => setEdits({ ...edits, [item.id]: value })}
                        lessLabel={t("stock.fewer", { name: item.name })}
                        moreLabel={t("stock.more", { name: item.name })}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="flex justify-between px-1 font-semibold">
            <span>{t("stock.total")}</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </p>
          <p className="text-xs text-eko-muted">{t("stock.listNote")}</p>
        </div>
      ) : (
        <p className="text-sm text-eko-muted">{t("stock.nothingToOrder")}</p>
      )}
    </Sheet>
  );
}
