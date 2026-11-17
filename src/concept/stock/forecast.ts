import type { DateKey, DemoState, StockItem, Supplier } from "../data/types";
import { weeklyUsage } from "./usage";

export interface ForecastInput {
  product: string;
  quantity: number;
  dailyUsage: number;
  leadTimeDays: number;
}

export interface Forecast {
  product: string;
  daysRemaining: number | null;
  orderQuantity: number;
  summary: string;
}

/** Days left and what to order to cover delivery plus a week. Also the fallback of the `stock-forecast` AI task. */
export function ruleForecast({ product, quantity, dailyUsage, leadTimeDays }: ForecastInput): Forecast {
  const daysRemaining = dailyUsage ? Math.floor(quantity / dailyUsage) : null;
  const orderQuantity = Math.max(0, Math.ceil((leadTimeDays + 7) * dailyUsage - quantity));
  const summary = daysRemaining === null ? `No recorded consumption for ${product}.` : `${product}: about ${daysRemaining} days remaining. Proposed purchase: ${orderQuantity}.`;
  return { product, daysRemaining, orderQuantity, summary };
}

export function supplierOf(state: DemoState, item: StockItem): Supplier | undefined {
  return state.suppliers.find((s) => s.name === item.supplier);
}

/** What the forecast task is asked about one product today. */
export function forecastInput(state: DemoState, item: StockItem, today: DateKey): ForecastInput {
  return {
    product: item.name,
    quantity: item.inStock,
    dailyUsage: Math.round((weeklyUsage(state, item, today) / 7) * 1000) / 1000,
    leadTimeDays: supplierOf(state, item)?.leadDays ?? 0,
  };
}
