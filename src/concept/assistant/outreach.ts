import type { Proposal } from "../command/proposal";
import { buildCustomerStats, findCustomer, lowStock } from "../selectors";
import { dueBackList } from "../customers/return-visits";
import { bookingPageLink, timeSuggestionText } from "../customers/time-suggestion";
import type { DemoState } from "../data/types";
import type { Clock } from "../finance/types";
import { t, tc } from "../i18n";
import { formatMoney } from "../i18n/format";
import { buildOrders, purchaseQuantity } from "../stock/purchase";
import type { OutgoingText } from "./actions";
import type { Routine } from "./routines";

// The proposals the assistant drafts on its own: an offer to a group of
// customers, and what a routine prepares when it runs. Each is a "change"
// proposal with one store action, approved like any other.

export const OFFER_PERCENT = 10;
/** The discounts an assistant offer may carry, the same ceiling as a campaign. */
export const OFFER_PERCENT_RANGE = { min: 1, max: 90 } as const;
const PREVIEW_NAMES = 3;

const names = (state: DemoState, texts: OutgoingText[]) => {
  const first = texts.slice(0, PREVIEW_NAMES).map((text) => findCustomer(state, text.customerId)?.firstName ?? "");
  return texts.length > PREVIEW_NAMES ? t("assistant.offer.namesMore", { names: first.join(", "), count: texts.length - PREVIEW_NAMES }) : first.join(", ");
};

/** A simulated text with a welcome-back offer to each customer. */
export function offerProposal(state: DemoState, customerIds: string[], clock: Clock, percent = OFFER_PERCENT): Proposal {
  const customers = customerIds.flatMap((id) => findCustomer(state, id) ?? []);
  if (!customers.length) return { kind: "message", text: t("assistant.offer.nobody") };
  const texts: OutgoingText[] = customers.map((customer) => ({
    customerId: customer.id,
    title: t("assistant.offer.logTitle", { name: customer.firstName }),
    body: t("assistant.offer.sms", { name: customer.firstName, salon: state.salon.name, percent, link: bookingPageLink(state) }),
  }));
  return {
    kind: "change",
    title: tc("assistant.offer.title", texts.length),
    subtitle: t("assistant.offer.subtitle"),
    rows: [
      { label: t("assistant.row.to"), after: names(state, texts) },
      { label: t("assistant.row.offer"), after: t("assistant.offer.what", { percent }) },
      { label: t("assistant.row.message"), after: texts[0].body },
    ],
    action: { type: "customers/message", texts, at: { date: clock.today, time: clock.minutes } },
    toast: tc("assistant.offer.sent", texts.length),
  };
}

/** Time suggestions to everyone who is overdue and has not had one yet. */
function remindersProposal(state: DemoState, clock: Clock): Proposal {
  const due = dueBackList(state, buildCustomerStats(state, clock.today), clock.today).filter((row) => !row.sent);
  if (!due.length) return { kind: "message", text: t("routine.reminders.none") };
  const texts = due.map((row) => timeSuggestionText(state, row.customer, row.service, clock.today));
  return {
    kind: "change",
    title: tc("routine.reminders.title", texts.length),
    subtitle: t("assistant.offer.subtitle"),
    rows: [
      { label: t("assistant.row.to"), after: names(state, texts) },
      { label: t("assistant.row.message"), after: texts[0].body },
    ],
    action: { type: "customers/message", texts, at: { date: clock.today, time: clock.minutes } },
    toast: tc("routine.reminders.sent", texts.length),
  };
}

/** One order per supplier for everything at or below its reorder level. */
function restockProposal(state: DemoState, clock: Clock): Proposal {
  const low = state.modules.stock ? lowStock(state) : [];
  if (!low.length) return { kind: "message", text: t("routine.stock.none") };
  const lines = low.map((item) => ({ item, quantity: purchaseQuantity(state, item, clock.today) }));
  return {
    kind: "change",
    title: tc("routine.stock.title", low.length),
    rows: [
      ...lines.map(({ item, quantity }) => ({ label: item.name, after: t("command.stock.quantity", { count: quantity, unit: item.unit }) })),
      { label: t("command.row.cost"), after: formatMoney(lines.reduce((sum, { item, quantity }) => sum + quantity * item.unitCost, 0)) },
    ],
    action: { type: "stock/order", orders: buildOrders(state, lines, clock.today), at: { date: clock.today, time: clock.minutes } },
    toast: t("stock.ordered", { suppliers: [...new Set(low.map((item) => item.supplier))].join(", ") }),
  };
}

/** What a routine prepares when it runs: always a proposal, never a change. */
export function runRoutine(state: DemoState, routine: Routine, clock: Clock): Proposal {
  return routine.id === "monday-reminders" ? remindersProposal(state, clock) : restockProposal(state, clock);
}
