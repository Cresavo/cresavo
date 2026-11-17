import type { DemoAction } from "../actions";
import { formatTime } from "../data/dates";
import type { Booking, DemoState } from "../data/types";
import { paidWithCards } from "../giftcards/cards";
import { t, tc } from "../i18n";
import { formatDayShort, formatMoney } from "../i18n/format";
import { findCustomer, findService, fullName } from "../selectors";

/** Reading a message or dismissing a card is not a change worth logging. */
export type LoggedAction = Exclude<DemoAction, { type: "inbox/read" | "inbox/read-all" | "card/dismiss" }>;

export function isLogged(action: DemoAction): action is LoggedAction {
  return action.type !== "inbox/read" && action.type !== "inbox/read-all" && action.type !== "card/dismiss";
}

export interface Description {
  summary: string;
  before?: string;
  after?: string;
}

const customerName = (state: DemoState, id: string | undefined) => {
  const customer = findCustomer(state, id);
  return customer ? fullName(customer) : t("log.someone");
};
const serviceName = (state: DemoState, id: string) => findService(state, id)?.name ?? t("log.aTreatment");
const when = (state: DemoState, b: Booking) => `${formatDayShort(b.date)} ${formatTime(b.start)} · ${state.staff.find((s) => s.id === b.staffId)?.firstName ?? ""}`;
const productName = (state: DemoState, id: string) => state.stock.find((s) => s.id === id)?.name ?? t("log.aProduct");
const bookingOf = (state: DemoState, id: string) => state.bookings.find((b) => b.id === id);
const names = (list: string[]) => list.join(", ");

/** One short sentence per change. It names people and things but never quotes journal text or messages. */
export function describeAction(action: LoggedAction, prev: DemoState, next: DemoState): Description {
  switch (action.type) {
    case "booking/move": {
      const old = bookingOf(prev, action.id)!;
      const now = bookingOf(next, action.id)!;
      return { summary: t("log.bookingMove", { customer: customerName(prev, old.customerId), service: serviceName(prev, old.serviceId) }), before: when(prev, old), after: when(next, now) };
    }
    case "booking/cancel": {
      const old = bookingOf(prev, action.id)!;
      return { summary: t("log.bookingCancel", { customer: customerName(prev, old.customerId), service: serviceName(prev, old.serviceId) }), before: when(prev, old), after: action.reason ? t("log.cancelledWith", { reason: action.reason }) : t("log.cancelled") };
    }
    case "booking/create": {
      const made = next.bookings[next.bookings.length - 1];
      return { summary: t("log.bookingCreate", { customer: customerName(next, action.customerId), service: serviceName(next, action.serviceId) }), after: when(next, made) };
    }
    case "online/book": {
      const made = next.bookings[next.bookings.length - 1];
      return { summary: t("log.onlineBook", { customer: customerName(next, made.customerId), service: serviceName(next, action.serviceId) }), after: when(next, made) };
    }
    case "online/waitlist":
      return { summary: t("log.onlineWaitlist", { customer: action.guest.name.trim(), service: serviceName(next, action.serviceId) }) };
    case "booking/complete": {
      const b = bookingOf(prev, action.id)!;
      return { summary: t("log.bookingComplete", { customer: customerName(prev, b.customerId), service: serviceName(prev, b.serviceId) }) };
    }
    case "service/price": {
      const service = findService(next, action.id)!;
      return { summary: t("log.servicePrice", { service: service.name }), before: formatMoney(findService(prev, action.id)!.price), after: formatMoney(service.price) };
    }
    case "service/recall": {
      const service = findService(next, action.id)!;
      return { summary: t("log.serviceRecall", { service: service.name }), before: tc("log.weeks", findService(prev, action.id)!.recallWeeks), after: tc("log.weeks", service.recallWeeks) };
    }
    case "campaign/launch":
      return { summary: t("log.campaignLaunch", { name: action.campaign.name }) };
    case "campaign/ad":
      return { summary: t("log.campaignAd", { name: next.campaigns.find((c) => c.id === action.id)!.name }), after: t("log.adDetail", { budget: formatMoney(action.ad.budget), days: action.ad.days }) };
    case "journal/add":
      return { summary: t("log.journalAdd", { customer: customerName(next, action.entry.customerId) }) };
    case "journal/edit":
      return { summary: t("log.journalEdit", { customer: customerName(next, next.journals.find((j) => j.id === action.id)!.customerId) }) };
    case "customers/import":
      return { summary: tc("log.customersImport", next.customers.length - prev.customers.length) };
    case "customer/note":
      return { summary: t("log.customerNote", { customer: customerName(next, action.id) }) };
    case "customer/delete":
      return { summary: t("log.customerDelete", { customer: customerName(prev, action.id) }) };
    case "stock/adjust": {
      const item = next.stock.find((s) => s.id === action.id)!;
      return { summary: t("log.stockAdjust", { product: item.name }), before: String(prev.stock.find((s) => s.id === action.id)!.inStock), after: String(item.inStock) };
    }
    case "stock/update":
      return { summary: t("log.stockUpdate", { product: productName(next, action.id) }) };
    case "stock/order":
      return { summary: t("log.stockOrder", { suppliers: names(action.orders.map((o) => o.supplier)) }) };
    case "stock/receive":
      return { summary: t("log.stockReceive", { products: names(action.deliveries.map((d) => productName(next, d.stockId))) }) };
    case "product/sell":
      return { summary: t("log.productSell", { product: productName(next, action.stockId), customer: customerName(next, action.customerId) }) };
    case "giftcard/sell":
      return { summary: t("log.giftcardSell", { code: next.giftCards.at(-1)!.code }), after: formatMoney(action.amount) };
    case "giftcard/redeem": {
      const b = bookingOf(next, action.bookingId)!;
      return { summary: t("log.giftcardRedeem", { customer: customerName(next, b.customerId), service: serviceName(next, b.serviceId) }), after: formatMoney(paidWithCards(next, b.id)) };
    }
    case "package/sell": {
      const pkg = next.packages.at(-1)!;
      return { summary: t("log.packageSell", { service: serviceName(next, action.serviceId), customer: customerName(next, action.customerId) }), after: formatMoney(pkg.price) };
    }
    case "inbox/reply":
      return { summary: t("log.inboxReply") };
    case "inbox/add":
      return { summary: t("log.inboxAdd", { title: action.item.title }) };
    case "review/reply":
      return { summary: t("log.reviewReply") };
    case "review/submit":
      return { summary: t("log.reviewSubmit", { rating: action.rating }) };
    case "review/approve":
      return { summary: t("log.reviewApprove") };
    case "booking-message/send": {
      const booking = bookingOf(next, action.bookingId);
      return { summary: t(`log.message.${action.kind}`, { channel: action.channel.toUpperCase(), customer: booking ? customerName(next, booking.customerId) : "" }) };
    }
    case "cost/add":
      return { summary: t("log.costAdd", { label: action.label.trim() }), after: formatMoney(action.amount) };
    case "cost/remove":
      return { summary: t("log.costRemove", { label: prev.costs.find((c) => c.id === action.id)!.label }) };
    case "accounting/connect":
      return { summary: t("log.accountingConnect") };
    case "accounting/disconnect":
      return { summary: t("log.accountingDisconnect") };
    case "module/toggle":
      return { summary: t(next.modules[action.key] ? "log.moduleOn" : "log.moduleOff", { module: t(`features.${action.key}`) }) };
    case "trash/restore": {
      const entry = prev.trash.find((e) => e.id === action.id)!;
      return { summary: t("log.trashRestore", { what: entry.kind === "customer" ? fullName(entry.customer) : customerName(prev, bookingOf(prev, entry.bookingId)?.customerId) }) };
    }
    case "log/undo":
      return { summary: t("log.undid", { what: prev.log.find((e) => e.id === action.id)!.summary }) };
    case "support/grant":
      return { summary: t("log.supportGrant", { hours: action.hours }) };
    case "support/revoke":
      return { summary: t("log.supportRevoke") };
    case "ticket/create":
      return { summary: t("log.ticketCreate") };
  }
}
