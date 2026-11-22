import type { DemoAction } from "../actions";
import { formatTime } from "../data/dates";
import type { Booking, DemoState } from "../data/types";
import { paidWithCards } from "../giftcards/cards";
import { changedAspects } from "../page/diff";
import { changedDetails } from "../ops/salon-details";
import { t, tc } from "../i18n";
import { formatDayShort, formatDuration, formatMoney } from "../i18n/format";
import { findCustomer, findService, fullName } from "../selectors";
import { moduleById, moduleEnabled } from "../modules/registry";

/** Reading a message or dismissing a card is not a change worth logging. */
export type LoggedAction = Exclude<DemoAction, { type: "inbox/read" | "inbox/read-all" | "card/dismiss" | "routine/ran" | "journal/view" }>;

/** A read of a journal has its own log (`journalAccess`) that shows who read what; the activity log is for changes. */
export function isLogged(action: DemoAction): action is LoggedAction {
  return action.type !== "inbox/read" && action.type !== "inbox/read-all" && action.type !== "card/dismiss" && action.type !== "routine/ran" && action.type !== "journal/view";
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
const staffFirstName = (state: DemoState, id: string) => state.staff.find((s) => s.id === id)?.firstName ?? id;

/** One short sentence per change. It names people and things but never quotes journal text or messages. */
export function describeAction(action: LoggedAction, prev: DemoState, next: DemoState): Description {
  switch (action.type) {
    case "salon/policy":
      return { summary: t("protection.saved"), before: String(prev.cancellationPolicy.version), after: String(next.cancellationPolicy.version) };
    case "online/hold":
      return { summary: t("protection.held") };
    case "online/release":
      return { summary: t("protection.released") };
    case "booking/fee":
      return { summary: t(action.incident === "late" ? "protection.late" : "status.noshow"), after: t(action.outcome === "waive" ? "protection.waived" : "protection.charged") };
    case "salon/language":
      return { summary: t("log.bookingLanguage") };
    case "salon/details": {
      const fields = changedDetails(prev.salon, next.salon);
      const renamed = fields.includes("name");
      return {
        summary: t("log.salonDetails", { what: fields.map((field) => t(`salonDetails.${field}`).toLowerCase()).join(", ") }),
        before: renamed ? prev.salon.name : undefined,
        after: renamed ? next.salon.name : undefined,
      };
    }
    case "reminder/settings":
      return { summary: t("log.reminderSettings") };
    case "memory/add":
      return { summary: t("log.memoryAdd") };
    case "memory/edit":
      return { summary: t("log.memoryEdit") };
    case "memory/forget":
      return { summary: t("log.memoryForget") };
    case "routine/add":
      return { summary: t("log.routineAdd", { name: action.routine.name }) };
    case "routine/toggle": {
      const routine = next.routines.find((r) => r.id === action.id)!;
      return { summary: t(routine.enabled ? "log.routineOn" : "log.routineOff", { name: routine.name }) };
    }
    case "customers/message":
      return { summary: tc("log.customersMessage", next.inbox.length - prev.inbox.length) };
    case "booking/move":
    case "online/move": {
      const old = bookingOf(prev, action.id)!;
      const now = bookingOf(next, action.id)!;
      return { summary: t("log.bookingMove", { customer: customerName(prev, old.customerId), service: serviceName(prev, old.serviceId) }), before: when(prev, old), after: when(next, now) };
    }
    case "booking/cancel": {
      const old = bookingOf(prev, action.id)!;
      return { summary: t("log.bookingCancel", { customer: customerName(prev, old.customerId), service: serviceName(prev, old.serviceId) }), before: when(prev, old), after: action.reason ? t("log.cancelledWith", { reason: action.reason }) : t("log.cancelled") };
    }
    case "online/cancel": {
      const old = bookingOf(prev, action.id)!;
      return { summary: t("log.bookingCancel", { customer: customerName(prev, old.customerId), service: serviceName(prev, old.serviceId) }), before: when(prev, old), after: t("log.cancelled") };
    }
    case "booking/create": {
      const made = next.bookings[next.bookings.length - 1];
      return { summary: t("log.bookingCreate", { customer: customerName(next, made.customerId), service: serviceName(next, made.serviceId) }), after: when(next, made) };
    }
    case "online/pay":
    case "online/book": {
      const made = next.bookings[next.bookings.length - 1];
      return { summary: t("log.onlineBook", { customer: customerName(next, made.customerId), service: serviceName(next, made.serviceId) }), after: when(next, made) };
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
    case "customer/update":
      return { summary: t("log.customerUpdate", { customer: customerName(next, action.id) }) };
    case "booking/update":
      return { summary: t("log.bookingUpdate", { customer: customerName(next, bookingOf(next, action.id)?.customerId) }) };
    case "customer/keep":
      return { summary: t("log.customerKeep", { customer: customerName(next, action.id) }) };
    case "privacy/journal-retention":
      return { summary: action.years === null ? t("log.journalRetentionOff") : tc("log.journalRetention", action.years) };
    case "customer/delete":
      return { summary: t("log.customerDelete", { customer: customerName(prev, action.id) }) };
    case "customer/erase":
      // Never names the customer: the entry outlives the erasure.
      return { summary: t("log.customerErase") };
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
    case "page/set":
      return { summary: t("log.pageSet", { what: changedAspects(prev.page, next.page).map((aspect) => t(`page.aspect.${aspect}`)).join(", ") }) };
    case "salon/slug":
      return { summary: t("log.salonSlug"), before: prev.salon.slug, after: next.salon.slug };
    case "domain/connect":
      return { summary: t("log.domainConnect", { host: next.domain!.host }) };
    case "domain/check":
      return { summary: t("log.domainCheck", { host: next.domain!.host, status: t(`domain.status.${next.domain!.status}`) }) };
    case "domain/remove":
      return { summary: t("log.domainRemove", { host: prev.domain!.host }) };
    case "module/toggle":
      return { summary: t(moduleEnabled(next.modules, action.key) ? "log.moduleOn" : "log.moduleOff", { module: t(moduleById(action.key).name) }) };
    case "module/preset":
      return { summary: t(`log.preset.${action.preset}`) };
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
    case "salon/hours":
      return { summary: t("log.salonHours") };
    case "salon/close":
      return { summary: t("log.salonClose", { date: formatDayShort(action.date) }), after: action.name.trim() };
    case "salon/reopen": {
      const closure = prev.salon.closures.find((c) => c.id === action.id)!;
      return { summary: t("log.salonReopen", { date: formatDayShort(closure.date) }), before: closure.name };
    }
    case "staff/block":
      return { summary: t("pair.block", { staff: staffFirstName(next, action.staffId) }), after: `${action.date} ${formatTime(action.start)}–${formatTime(action.end)}` };
    case "staff/week":
      return { summary: t("log.staffWeek", { name: staffFirstName(next, action.staffId) }) };
    case "staff/off":
      return { summary: t("log.staffOff", { name: staffFirstName(next, action.staffId) }), after: names([...new Set(action.dates)].map((day) => formatDayShort(day))) };
    case "staff/shift":
      return { summary: t("log.staffShift", { name: staffFirstName(next, action.staffId) }), after: `${formatDayShort(action.date)} ${formatTime(action.start)}–${formatTime(action.end)}` };
    case "staff/exception-remove": {
      const exception = prev.exceptions.find((e) => e.id === action.id)!;
      return { summary: t("log.exceptionRemove", { name: staffFirstName(prev, exception.staffId) }), before: formatDayShort(exception.date) };
    }
    case "resource/add":
      return { summary: t("log.resourceAdd", { name: action.name.trim() }) };
    case "resource/rename":
      return { summary: t("log.resourceRename", { name: action.name.trim() }), before: prev.resources.find((r) => r.id === action.id)?.name };
    case "resource/remove":
      return { summary: t("log.resourceRemove", { name: prev.resources.find((r) => r.id === action.id)!.name }) };
    case "service/resources":
      return { summary: t("log.serviceResources", { service: serviceName(next, action.id) }) };
    case "service/add":
      return { summary: t("log.serviceAdd", { service: action.service.name.trim() }), after: `${formatDuration(action.service.duration)} · ${formatMoney(action.service.price)}` };
    case "service/update": {
      const line = (state: DemoState) => {
        const service = findService(state, action.id)!;
        return `${service.name} · ${formatDuration(service.duration)} · ${formatMoney(service.price)}`;
      };
      return { summary: t("log.serviceUpdate", { service: serviceName(next, action.id) }), before: line(prev), after: line(next) };
    }
    case "service/visibility":
      return { summary: t(action.hidden ? "log.serviceHide" : "log.serviceShow", { service: serviceName(next, action.id) }) };
    case "service/duplicate":
      return { summary: t("log.serviceDuplicate", { service: serviceName(prev, action.id) }), after: next.services.find((s) => !prev.services.some((old) => old.id === s.id))!.name };
    case "service/delete": {
      const kept = prev.bookings.filter((b) => b.serviceId === action.id && b.status === "booked" && b.date >= prev.generatedFor).length;
      return { summary: t("log.serviceDelete", { service: serviceName(prev, action.id) }), after: kept ? tc("log.serviceDeleteKept", kept) : undefined };
    }
    case "service/move":
    case "service/reorder":
      return { summary: t("log.serviceMove") };
    case "category/add":
      return { summary: t("log.categoryAdd", { name: action.name.trim() }) };
    case "category/rename":
      return { summary: t("log.categoryRename", { name: action.name.trim() }), before: prev.categories.find((c) => c.id === action.id)!.name };
    case "category/remove":
      return { summary: t("log.categoryRemove", { name: prev.categories.find((c) => c.id === action.id)!.name }) };
    case "category/move":
    case "category/reorder":
      return { summary: t("log.categoryMove") };
  }
}
