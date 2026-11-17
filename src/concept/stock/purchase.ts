import type { DateKey, DemoState, OrderLine, StockItem } from "../data/types";
import { t } from "../i18n";
import { formatDayMonth, formatMoney } from "../i18n/format";
import { lowStock } from "../selectors";
import { supplierOf } from "./forecast";
import type { NewOrder } from "./orders";
import { weeklyUsage } from "./usage";

export interface PurchaseLine {
  item: StockItem;
  quantity: number;
}

const COVER_WEEKS = 4;

/** Enough for about four weeks plus the safety level. */
export function purchaseQuantity(state: DemoState, item: StockItem, today: DateKey): number {
  return Math.max(1, Math.ceil(weeklyUsage(state, item, today) * COVER_WEEKS + item.reorderAt - item.inStock - item.onOrder));
}

/** The purchase list: everything that is, or will be, below its minimum level, with a proposed amount. */
export function purchaseList(state: DemoState, today: DateKey): PurchaseLine[] {
  return lowStock(state).map((item) => ({ item, quantity: purchaseQuantity(state, item, today) }));
}

export interface SupplierGroup {
  supplier: string;
  lines: PurchaseLine[];
  total: number;
}

export function groupBySupplier(lines: PurchaseLine[]): SupplierGroup[] {
  const groups = new Map<string, PurchaseLine[]>();
  for (const line of lines) groups.set(line.item.supplier, [...(groups.get(line.item.supplier) ?? []), line]);
  return [...groups.entries()].map(([supplier, list]) => ({ supplier, lines: list, total: list.reduce((sum, l) => sum + l.quantity * l.item.unitCost, 0) }));
}

/** One order and email draft per supplier. Nothing is sent: the email is only saved in Inbox. */
export function buildOrders(state: DemoState, lines: PurchaseLine[], today: DateKey): NewOrder[] {
  return groupBySupplier(lines.filter((l) => l.quantity > 0)).map(({ supplier, lines: list, total }) => {
    const info = supplierOf(state, list[0].item);
    const orderLines: OrderLine[] = list.map((l) => ({ stockId: l.item.id, quantity: l.quantity, unitCost: l.item.unitCost }));
    const rows = list.map((l) => t("stock.email.line", { quantity: l.quantity, unit: l.item.unit, name: l.item.name, price: formatMoney(l.item.unitCost) })).join("\n");
    const body = [
      t("stock.email.to", { email: info?.email ?? "" }),
      t("stock.email.subject", { salon: state.salon.name, date: formatDayMonth(today) }),
      "",
      t("stock.email.greeting", { supplier }),
      "",
      t("stock.email.intro", { salon: state.salon.name }),
      "",
      rows,
      "",
      t("stock.email.total", { total: formatMoney(total) }),
      t("stock.email.closing", { salon: state.salon.name }),
    ].join("\n");
    return { supplier, lines: orderLines, email: { title: t("stock.email.title", { supplier }), body } };
  });
}
