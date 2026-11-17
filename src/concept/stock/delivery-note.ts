import { addDays } from "../data/dates";
import type { DateKey, DemoState, PurchaseOrder } from "../data/types";
import type { Delivery } from "./orders";

/** What the demo "reads" from a photographed delivery note when nothing is on order. */
const LOOSE_NOTE: { supplier: string; deliveries: Delivery[] } = {
  supplier: "Medicinab",
  deliveries: [
    { stockId: "gloves", quantity: 2 },
    { stockId: "couch-roll", quantity: 6 },
    { stockId: "skin-disinfectant", quantity: 2 },
  ],
};

export interface ReadNote {
  supplier: string;
  deliveries: Delivery[];
}

/** The predefined result of "photo of delivery note": an open order arrives as ordered, otherwise a fixed example. */
export function readDeliveryNote(state: DemoState, order?: PurchaseOrder): ReadNote {
  if (order) return { supplier: order.supplier, deliveries: order.lines.map((l) => ({ stockId: l.stockId, quantity: l.quantity })) };
  return { supplier: LOOSE_NOTE.supplier, deliveries: LOOSE_NOTE.deliveries.filter((d) => state.stock.some((s) => s.id === d.stockId)) };
}

/** Open orders, oldest first. */
export function openOrders(state: DemoState): PurchaseOrder[] {
  return state.orders.filter((o) => o.status === "open").sort((a, b) => a.date.localeCompare(b.date));
}

/** Open orders whose supplier lead time has passed. */
export function overdueOrders(state: DemoState, today: DateKey): PurchaseOrder[] {
  return openOrders(state).filter((o) => addDays(o.date, leadDaysOf(state, o)) <= today);
}

export const leadDaysOf = (state: DemoState, order: PurchaseOrder) => state.suppliers.find((s) => s.name === order.supplier)?.leadDays ?? 0;
