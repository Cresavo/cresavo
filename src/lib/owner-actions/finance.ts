import { z } from "zod";
import { MAX_AMOUNT, MIN_AMOUNT } from "@/concept/giftcards/cards";
import { date, id, list, minutes, quantity, required, text } from "./primitives";

/** A cost as typed in the form: it may have decimals, which the reducer rounds to whole kronor. */
const costAmount = z.number().min(0).max(1_000_000);

// Costs, accounting, gift cards, punch cards and stock.

const MAX_ORDERS = 50;
const MAX_LINES = 200;
const unitCost = z.number().min(0).max(1_000_000);

const orderLine = z.strictObject({ stockId: id, quantity, unitCost, received: quantity.optional() });

export const financeSchemas = {
  "cost/add": z.strictObject({
    type: z.literal("cost/add"), kind: z.enum(["rent", "products", "wages", "fees", "other"]), label: required(), amount: costAmount,
  }),
  "cost/remove": z.strictObject({ type: z.literal("cost/remove"), id }),
  "accounting/connect": z.strictObject({ type: z.literal("accounting/connect"), on: date }),
  "accounting/disconnect": z.strictObject({ type: z.literal("accounting/disconnect") }),
  "giftcard/sell": z.strictObject({
    type: z.literal("giftcard/sell"), amount: z.number().int().min(MIN_AMOUNT).max(MAX_AMOUNT), recipient: required(), message: text(), date,
  }),
  "giftcard/redeem": z.strictObject({ type: z.literal("giftcard/redeem"), code: required(40), bookingId: id, date }),
  "package/sell": z.strictObject({ type: z.literal("package/sell"), customerId: id, serviceId: id, date }),
  "product/sell": z.strictObject({ type: z.literal("product/sell"), customerId: id, stockId: id, quantity, date }),
  "stock/adjust": z.strictObject({ type: z.literal("stock/adjust"), id, delta: z.number().min(-100_000).max(100_000) }),
  "stock/order": z.strictObject({
    type: z.literal("stock/order"),
    orders: list(z.strictObject({
      supplier: required(),
      lines: list(orderLine, MAX_LINES),
      email: z.strictObject({ title: required(), body: text() }),
    }), MAX_ORDERS),
    at: z.strictObject({ date, time: minutes }),
  }),
  "stock/receive": z.strictObject({
    type: z.literal("stock/receive"), orderId: id.optional(), deliveries: list(z.strictObject({ stockId: id, quantity }), MAX_LINES), date,
  }),
  "stock/update": z.strictObject({
    type: z.literal("stock/update"),
    id,
    patch: z.strictObject({ reorderAt: quantity.optional(), supplier: text().optional(), unitCost: unitCost.optional(), salePrice: unitCost.optional() }),
  }),
};
