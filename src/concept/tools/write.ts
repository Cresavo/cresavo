import { z } from "zod";
import { proposalFor, type Proposal } from "../command/proposal";
import type { IntentAction, IntentParams } from "../intent";
import { field, writeTool, ToolError, type ChangeDraft, type ToolContext } from "./define";

// Write tools never change anything. Each one builds the same proposal the
// command box would show for the same request (`proposalFor`), so slot
// checks, module switches and wording are shared. The result is a draft that
// waits for the owner's approval.

function draftFor({ state, clock }: ToolContext, action: IntentAction, params: IntentParams): ChangeDraft {
  const proposal: Proposal = proposalFor(state, { action, params, summary: "", confidence: 1 }, "", clock, []);
  switch (proposal.kind) {
    case "change":
      return { title: proposal.title, subtitle: proposal.subtitle, rows: proposal.rows, action: proposal.action, toast: proposal.toast, destructive: proposal.destructive };
    case "choose":
      throw new ToolError("not_possible", proposal.title, proposal.choices.map((choice) => choice.label));
    case "message":
      throw new ToolError("not_possible", proposal.text);
    default:
      throw new ToolError("not_possible", "This request does not lead to a change.");
  }
}

export const proposeBooking = writeTool({
  name: "propose_booking",
  title: "Propose a booking",
  description: "Propose booking a customer for a service at a day and time. If the time is taken, the error lists free alternatives. The owner approves in Flerdo.",
  input: z.object({ customerId: field.id, serviceId: field.id, date: field.date, time: field.time, staffId: field.staffId.optional() }).strict(),
  draft: (context, input) => draftFor(context, "book", input),
});

export const proposeMove = writeTool({
  name: "propose_move",
  title: "Propose moving a booking",
  description: "Propose moving a booking to another day and time with the same staff member. If the time is taken, the error lists free alternatives. The owner approves in Flerdo.",
  input: z.object({ bookingId: field.id, date: field.date, time: field.time }).strict(),
  draft: (context, input) => draftFor(context, "move", input),
});

export const proposeCancel = writeTool({
  name: "propose_cancel",
  title: "Propose cancelling a booking",
  description: "Propose cancelling a booking, optionally offering the freed slot to the waiting list. The owner approves in Flerdo.",
  input: z.object({ bookingId: field.id, offerWaitingList: z.boolean().optional() }).strict(),
  draft: (context, input) => draftFor(context, "cancel", input),
});

export const proposePrice = writeTool({
  name: "propose_price",
  title: "Propose a new price",
  description: "Propose a new price in SEK for a service. The owner approves in Flerdo.",
  input: z.object({ serviceId: field.id, priceSek: z.number().int().min(0).max(100_000) }).strict(),
  draft: (context, input) => draftFor(context, "change-price", input),
});

export const proposeStockOrder = writeTool({
  name: "propose_stock_order",
  title: "Propose a stock order",
  description: "Propose ordering a product from its supplier; the quantity covers delivery time plus a week. Name the product in words. The owner approves in Flerdo.",
  input: z.object({ product: z.string().trim().min(2).max(60) }).strict(),
  draft: (context, input) => draftFor(context, "order-stock", input),
});

export const proposeSale = writeTool({
  name: "propose_product_sale",
  title: "Propose a product sale",
  description: "Propose recording a product sold over the counter to a customer. The owner approves in Flerdo.",
  input: z.object({ customerId: field.id, product: z.string().trim().min(2).max(60), quantity: z.number().int().min(1).max(20).optional() }).strict(),
  draft: (context, input) => draftFor(context, "sell-product", input),
});

export const writeTools = [proposeBooking, proposeMove, proposeCancel, proposePrice, proposeStockOrder, proposeSale];
