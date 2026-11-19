import { ListRow } from "../../ui/list-row";
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
          <Card className="divide-y divide-hairline overflow-hidden">
            {state.stock.filter((s) => s.category === category).map((item) => {
              const isLow = item.inStock <= item.reorderAt;
              const left = days.get(item.id);
              return (
                <div key={item.id} className="flex items-center gap-2 pr-2 max-[319px]:flex-col max-[319px]:items-start max-[319px]:px-2 max-[319px]:pb-2">
                  <ListRow className="flex-1" onClick={() => onEdit(item)}
                    title={<span className="flex flex-wrap items-center gap-2">
                      <span><span className="sr-only">{t("stock.edit")} </span>{item.name}</span>
                      {isLow && <Badge tone="warn">{t("stock.low")}</Badge>}
                      {item.onOrder > 0 && <Badge tone="accent" icon={PackageCheck}>{t("stock.onOrder", { count: item.onOrder })}</Badge>}
                    </span>}
                    meta={<>
                      <span className="block">
                        {item.unit} · {item.supplier} · {t("stock.reorderAt", { count: item.reorderAt })}
                        {isLow && left !== null && left !== undefined && ` · ${left < 1 ? t("stock.almostOut") : tc("stock.runsOut", left)}`}
                      </span>
                      <Meter value={item.inStock / (item.reorderAt * 2.5)} className="max-w-xs" />
                    </>} />
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label={t("stock.remove")} onClick={() => dispatch({ type: "stock/adjust", id: item.id, delta: -1 })} className="ring-1 ring-hairline">
                      <Minus size={16} />
                    </IconButton>
                    <span className="w-10 text-center font-semibold tabular-nums">{formatAmount(item.inStock)}</span>
                    <IconButton label={t("stock.add")} onClick={() => dispatch({ type: "stock/adjust", id: item.id, delta: 1 })} className="ring-1 ring-hairline">
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
