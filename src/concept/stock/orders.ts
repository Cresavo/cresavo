import type { DateKey, DemoState, InboxItem, OrderLine, PurchaseOrder, StockItem } from "../data/types";
import { roundAmount } from "./usage";

/** An order as the purchase list builds it; the reducer adds ids, stock changes and the email in Inbox. */
export interface NewOrder {
  supplier: string;
  lines: OrderLine[];
  /** Email draft to the supplier, written from the dictionary by the caller. */
  email: { title: string; body: string };
}

export interface Delivery {
  stockId: string;
  quantity: number;
}

const updateItems = (stock: StockItem[], change: (item: StockItem) => StockItem) => stock.map(change);

/** Sends (simulated) each order: it is on order from now on and the email is saved in Inbox. */
export function placeOrders(state: DemoState, orders: NewOrder[], at: { date: DateKey; time: number }): DemoState {
  if (orders.some((o) => o.lines.some((l) => !state.stock.some((s) => s.id === l.stockId)) || new Set(o.lines.map((l) => l.stockId)).size !== o.lines.length)) return state;
  const valid = orders.filter((o) => o.lines.some((l) => l.quantity > 0));
  if (!valid.length) return state;
  let seq = state.seq;
  const placed: PurchaseOrder[] = [];
  const mails: InboxItem[] = [];
  for (const order of valid) {
    const lines = order.lines.filter((l) => l.quantity > 0).map(({ stockId, quantity, unitCost }) => ({ stockId, quantity, unitCost }));
    placed.push({ id: `o-${seq++}`, supplier: order.supplier, date: at.date, lines, status: "open" });
    mails.unshift({ id: `i-${seq++}`, kind: "system", date: at.date, time: at.time, title: order.email.title, body: order.email.body, read: false, handled: true });
  }
  return {
    ...state,
    seq,
    orders: [...placed, ...state.orders],
    inbox: [...mails, ...state.inbox],
    stock: updateItems(state.stock, (item) => {
      const quantity = placed.flatMap((o) => o.lines).filter((l) => l.stockId === item.id).reduce((sum, l) => sum + l.quantity, 0);
      return quantity ? { ...item, onOrder: item.onOrder + quantity } : item;
    }),
  };
}

/** What arrived of each item, split over the order's lines for it: each takes up to what it ordered, the last one the rest. */
function receivedPerLine(lines: OrderLine[], arrived: (stockId: string) => number): OrderLine[] {
  const left = new Map<string, number>();
  return lines.map((line, index) => {
    const remaining = left.get(line.stockId) ?? arrived(line.stockId);
    const isLast = !lines.slice(index + 1).some((other) => other.stockId === line.stockId);
    const received = isLast ? remaining : Math.min(remaining, line.quantity);
    left.set(line.stockId, remaining - received);
    return { ...line, received };
  });
}

/**
 * Goods in. What arrived is added to the stock. When it belongs to an order,
 * that order is closed and the ordered amounts stop counting as "on order".
 */
export function receiveGoods(state: DemoState, input: { orderId?: string; deliveries: Delivery[]; date: DateKey }): DemoState {
  const positive = input.deliveries.filter((d) => d.quantity > 0);
  const order = input.orderId ? state.orders.find((o) => o.id === input.orderId) : undefined;
  if (input.orderId && order?.status !== "open") return state;
  const stocked = (stockId: string) => state.stock.some((s) => s.id === stockId);
  // On an order, an item that is no longer stocked is ignored; anything else the order does not hold, or that is not stocked, refuses the receipt.
  if (!positive.every((d) => (order ? order.lines.some((l) => l.stockId === d.stockId) : stocked(d.stockId)))) return state;
  const deliveries = positive.filter((d) => stocked(d.stockId));
  if (!deliveries.length) return state;
  const arrived = (stockId: string) => deliveries.filter((d) => d.stockId === stockId).reduce((sum, d) => sum + d.quantity, 0);
  return {
    ...state,
    stock: updateItems(state.stock, (item) => {
      const ordered = order?.lines.filter((l) => l.stockId === item.id).reduce((sum, l) => sum + l.quantity, 0) ?? 0;
      if (!arrived(item.id) && !ordered) return item;
      return { ...item, inStock: roundAmount(item.inStock + arrived(item.id)), onOrder: Math.max(0, item.onOrder - ordered) };
    }),
    orders: state.orders.map((o) =>
      o.id === order?.id ? { ...o, status: "received" as const, receivedOn: input.date, lines: receivedPerLine(o.lines, arrived) } : o,
    ),
  };
}
