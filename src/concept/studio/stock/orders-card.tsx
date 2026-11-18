import { PackageCheck } from "lucide-react";
import type { PurchaseOrder } from "../../data/types";
import { addDays } from "../../data/dates";
import { t, tc } from "../../i18n";
import { formatDayMonth, formatMoney } from "../../i18n/format";
import { leadDaysOf } from "../../stock/delivery-note";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";

/** Orders sent to suppliers that have not arrived yet, each with a one-tap "Goods received". */
export function OrdersCard({ orders, onReceive }: { orders: PurchaseOrder[]; onReceive: (id: string) => void }) {
  const { state, today } = useStudio();
  return (
    <Card className="divide-y divide-hairline overflow-hidden">
      {orders.map((order) => {
        const arrives = addDays(order.date, leadDaysOf(state, order));
        const total = order.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
        return (
          <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <PackageCheck size={20} className="shrink-0 text-action" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {order.supplier}
                {arrives <= today && <Badge tone="warn">{t("stock.overdue")}</Badge>}
              </p>
              <p className="text-sm text-text-secondary">{tc("stock.orderLine", order.lines.length, { date: formatDayMonth(order.date), total: formatMoney(total) })}</p>
              <p className="text-xs text-text-secondary">{t("stock.arrives", { date: formatDayMonth(arrives) })}</p>
            </div>
            <Button size="sm" onClick={() => onReceive(order.id)}>{t("stock.receive")}</Button>
          </div>
        );
      })}
    </Card>
  );
}
