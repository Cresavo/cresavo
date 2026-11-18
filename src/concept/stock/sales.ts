import type { DateKey, DemoState, ProductSale, StockItem } from "../data/types";
import { roundAmount } from "./usage";

/** Products with a sale price: the ones that can be sold over the counter. */
export const sellable = (state: DemoState): StockItem[] => state.stock.filter((s) => s.salePrice !== undefined);

/** Sells a product to a customer: the balance drops and the sale counts as revenue. */
export function sellProduct(state: DemoState, input: { customerId: string; stockId: string; quantity: number; date: DateKey }): DemoState {
  const item = state.stock.find((s) => s.id === input.stockId);
  const quantity = Math.floor(input.quantity);
  if (!item || item.salePrice === undefined || quantity < 1 || item.inStock < quantity) return state;
  if (!state.customers.some((c) => c.id === input.customerId)) return state;
  const sale: ProductSale = { id: `s-${state.seq}`, customerId: input.customerId, stockId: item.id, quantity, amount: item.salePrice * quantity, date: input.date };
  return {
    ...state,
    seq: state.seq + 1,
    sales: [...state.sales, sale],
    stock: state.stock.map((s) => (s.id === item.id ? { ...s, inStock: roundAmount(s.inStock - quantity) } : s)),
  };
}

/** Money taken for products on days in [from, to] (inclusive). */
export function salesBetween(state: DemoState, from: DateKey, to: DateKey): number {
  return state.sales.filter((s) => s.date >= from && s.date <= to).reduce((sum, s) => sum + s.amount, 0);
}
