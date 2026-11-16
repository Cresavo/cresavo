"use client";

import { useState } from "react";
import { Minus, PackageCheck, Plus, ShoppingCart } from "lucide-react";
import type { StockItem } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatMoney } from "@/concept/i18n/format";
import { lowStock } from "@/concept/selectors";
import { dispatch, undo } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button, IconButton } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Meter } from "@/concept/ui/charts";
import { Sheet } from "@/concept/ui/sheet";
import { showToast } from "@/concept/ui/toast";

/** Enough for about four weeks plus the safety level. */
function suggestedQuantity(item: StockItem) {
  return Math.max(1, Math.ceil(item.usagePerWeek * 4 + item.reorderAt - item.inStock - item.onOrder));
}

export default function StockPage() {
  const { state } = useStudio();
  const [ordering, setOrdering] = useState(false);
  const low = lowStock(state);
  const lines = low.map((item) => ({ item, quantity: suggestedQuantity(item) }));
  const total = lines.reduce((sum, l) => sum + l.quantity * l.item.unitCost, 0);
  const suppliers = [...new Set(lines.map((l) => l.item.supplier))];
  const categories = [...new Set(state.stock.map((s) => s.category))];

  const approve = () => {
    dispatch({ type: "stock/order", lines: lines.map((l) => ({ id: l.item.id, quantity: l.quantity })) });
    showToast(t("stock.ordered", { suppliers: suppliers.join(", ") }), { label: t("common.undo"), run: undo });
    setOrdering(false);
  };

  return (
    <MorePage title={t("nav.stock")} subtitle={tc("stock.subtitle", state.stock.length)} module="stock">
      <div className="space-y-6">
        {low.length > 0 && (
          <Card className="flex flex-wrap items-center gap-4 bg-eko-warn-soft p-4 ring-eko-warn/20">
            <ShoppingCart size={22} className="shrink-0 text-eko-warn" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{tc("stock.lowTitle", low.length)}</p>
              <p className="text-sm text-eko-muted">{low.map((i) => i.name).join(", ")}</p>
            </div>
            <Button onClick={() => setOrdering(true)}>{t("stock.createOrder")}</Button>
          </Card>
        )}
        {categories.map((category) => (
          <Section key={category} title={category}>
            <Card className="divide-y divide-eko-line overflow-hidden">
              {state.stock.filter((s) => s.category === category).map((item) => {
                const isLow = item.inStock <= item.reorderAt;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {isLow && <Badge tone="warn">{t("stock.low")}</Badge>}
                        {item.onOrder > 0 && (
                          <Badge tone="accent">
                            <PackageCheck size={12} />
                            {t("stock.onOrder", { count: item.onOrder })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-eko-muted">{item.unit} · {item.supplier} · {t("stock.reorderAt", { count: item.reorderAt })}</p>
                      <Meter value={item.inStock / (item.reorderAt * 2.5)} tone={isLow ? "bg-eko-warn" : "bg-eko-accent"} className="max-w-xs" />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={t("stock.remove")} onClick={() => dispatch({ type: "stock/adjust", id: item.id, delta: -1 })} className="size-10 ring-1 ring-eko-line">
                        <Minus size={16} />
                      </IconButton>
                      <span className="w-8 text-center font-semibold tabular-nums">{item.inStock}</span>
                      <IconButton label={t("stock.add")} onClick={() => dispatch({ type: "stock/adjust", id: item.id, delta: 1 })} className="size-10 ring-1 ring-eko-line">
                        <Plus size={16} />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </Card>
          </Section>
        ))}
      </div>
      {ordering && (
        <Sheet
          open
          onClose={() => setOrdering(false)}
          title={t("stock.orderTitle")}
          description={t("stock.orderDescription")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOrdering(false)}>{t("common.cancel")}</Button>
              <Button disabled={!lines.length} onClick={approve}>{t("stock.approve")}</Button>
            </>
          }
        >
          {lines.length ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-eko-accent">{t("suggest.label")}</p>
              <ul className="divide-y divide-eko-line rounded-2xl ring-1 ring-eko-line">
                {lines.map(({ item, quantity }) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{item.name}</span>
                      <span className="block text-eko-muted">{quantity} × {item.unit} · {item.supplier}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(quantity * item.unitCost)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between px-1 font-semibold">
                <span>{t("stock.total")}</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-eko-muted">{t("stock.nothingToOrder")}</p>
          )}
        </Sheet>
      )}
    </MorePage>
  );
}
