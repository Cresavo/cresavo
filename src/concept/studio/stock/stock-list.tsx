import { Minus, PackageCheck, Plus } from "lucide-react";
import type { StockItem } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatAmount } from "../../i18n/format";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { IconButton } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Meter } from "../../ui/charts";
import { useStudio } from "../use-studio";
import { useForecasts } from "./use-forecasts";

/** Products by category: balance, a forecast for the ones running low, quick plus and minus. Tap a name to edit. */
export function StockList({ onEdit }: { onEdit: (item: StockItem) => void }) {
  const { state } = useStudio();
  const forecasts = useForecasts(state.stock);
  const days = new Map(state.stock.map((item, i) => [item.id, forecasts[i].daysRemaining]));
  const categories = [...new Set(state.stock.map((s) => s.category))];
  return (
    <>
      {categories.map((category) => (
        <Section key={category} title={category}>
          <Card className="divide-y divide-eko-line overflow-hidden">
            {state.stock.filter((s) => s.category === category).map((item) => {
              const isLow = item.inStock <= item.reorderAt;
              const left = days.get(item.id);
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" aria-label={t("stock.edit", { name: item.name })} onClick={() => onEdit(item)} className="min-w-0 flex-1 space-y-1.5 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {isLow && <Badge tone="warn">{t("stock.low")}</Badge>}
                      {item.onOrder > 0 && (
                        <Badge tone="accent">
                          <PackageCheck size={12} />
                          {t("stock.onOrder", { count: item.onOrder })}
                        </Badge>
                      )}
                    </span>
                    <span className="block text-xs text-eko-muted">
                      {item.unit} · {item.supplier} · {t("stock.reorderAt", { count: item.reorderAt })}
                      {isLow && left !== null && left !== undefined && ` · ${left < 1 ? t("stock.almostOut") : tc("stock.runsOut", left)}`}
                    </span>
                    <Meter value={item.inStock / (item.reorderAt * 2.5)} tone={isLow ? "bg-eko-warn" : "bg-eko-accent"} className="max-w-xs" />
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label={t("stock.remove")} onClick={() => dispatch({ type: "stock/adjust", id: item.id, delta: -1 })} className="size-10 ring-1 ring-eko-line">
                      <Minus size={16} />
                    </IconButton>
                    <span className="w-10 text-center font-semibold tabular-nums">{formatAmount(item.inStock)}</span>
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
    </>
  );
}
