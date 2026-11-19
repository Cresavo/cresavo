import { sendBookingMessage, type BookingMessageAction } from "./booking/messages";
import { applyCustomerReview, type CustomerReviewAction } from "./booking/review-actions";
import { applyAssistant, type AssistantAction } from "./assistant/actions";
import { findCustomerByPhone, isContactPhone, isMobilePhone, normalizePhone } from "./booking/lookup";
import { addAdResults, simulateStats } from "./campaigns/simulate";
import { textWaitlistAboutSlot } from "./booking/waitlist-offer";
import { sendDemoCampaign } from "./connections/demo";
import { editJournalEntry } from "./customers/journal";
import { MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "./customers/return-visits";
import type { CostKind } from "./finance/types";
import { isFree, needOf, pickResource } from "./data/slots";
import { undoEntry } from "./log/undo";
import { bookableServices } from "./selectors";
import { MODULES, presetModules, type PresetId } from "./modules/registry";
import { applyOps, type OpsAction } from "./ops/edit";
import { applyServiceAction, type ServiceAction } from "./services/edit";
import { applyPageAction, type PageAction } from "./page/actions";
import { grantSupport, revokeSupport, type GrantHours } from "./support/access";
import type { NewTicket } from "./support/tickets";
import { deleteCustomer, restoreEntry, trashBooking } from "./trash/trash";
import { placeOrders, receiveGoods, type Delivery, type NewOrder } from "./stock/orders";
import { redeemGiftCard, sellGiftCard } from "./giftcards/cards";
import { sellPackage, consumePackageVisit } from "./packages/packages";
import { sellProduct } from "./stock/sales";
import { deduct, roundAmount, usesOfService } from "./stock/usage";
import type {
  Booking,
  BookingSource,
  Campaign,
  CampaignAd,
  Customer,
  DateKey,
  DemoState,
  InboxItem,
  JournalContent,
  JournalEntry,
  ModuleKey,
  SlotSuggestion,
  StaffId,
  StockItem,
} from "./data/types";

// Every change to the demo goes through this pure reducer. Buttons use it
// today; the command box and AI suggestions will dispatch the same actions.

export type DemoAction =
  | BookingMessageAction
  | CustomerReviewAction
  | OpsAction
  | ServiceAction
  | AssistantAction
  | PageAction
  | { type: "booking/move"; id: string; date: DateKey; start: number; staffId?: StaffId; notice?: Omit<InboxItem, "id"> }
  | { type: "booking/cancel"; id: string; reason?: string; notice?: Omit<InboxItem, "id"> }
  | ({ type: "booking/create"; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource } & ({ customerId: string } | { newCustomer: GuestContact & { since: DateKey } }))
  | { type: "online/book"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId: StaffId; date: DateKey; start: number }
  | { type: "online/waitlist"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId?: StaffId }
  | { type: "service/price"; id: string; price: number }
  | { type: "campaign/launch"; campaign: NewCampaign; today: DateKey }
  | { type: "campaign/ad"; id: string; ad: CampaignAd }
  | { type: "journal/add"; entry: Omit<JournalEntry, "id"> }
  | { type: "journal/edit"; id: string; content: JournalContent; on: DateKey }
  | { type: "service/recall"; id: string; weeks: number }
  | { type: "customers/import"; customers: Omit<Customer, "id">[] }
  | { type: "stock/adjust"; id: string; delta: number }
  | { type: "stock/order"; orders: NewOrder[]; at: { date: DateKey; time: number } }
  | { type: "stock/receive"; orderId?: string; deliveries: Delivery[]; date: DateKey }
  | { type: "stock/update"; id: string; patch: StockPatch }
  | { type: "product/sell"; customerId: string; stockId: string; quantity: number; date: DateKey }
  | { type: "giftcard/sell"; amount: number; recipient: string; message: string; date: DateKey }
  | { type: "giftcard/redeem"; code: string; bookingId: string; date: DateKey }
  | { type: "package/sell"; customerId: string; serviceId: string; date: DateKey }
  | { type: "booking/complete"; id: string }
  | { type: "inbox/read"; id: string }
  | { type: "inbox/read-all" }
  | { type: "inbox/reply"; id: string; reply: string; slot?: SlotSuggestion }
  | { type: "inbox/add"; item: Omit<InboxItem, "id"> }
  | { type: "review/reply"; id: string; reply: string }
  | { type: "customer/note"; id: string; note: string }
  | { type: "cost/add"; kind: CostKind; label: string; amount: number }
  | { type: "cost/remove"; id: string }
  | { type: "accounting/connect"; on: DateKey }
  | { type: "accounting/disconnect" }
  | { type: "module/toggle"; key: ModuleKey }
  | { type: "module/preset"; preset: PresetId }
  | { type: "card/dismiss"; id: string }
  | { type: "customer/delete"; id: string }
  | { type: "trash/restore"; id: string }
  | { type: "log/undo"; id: string }
  | { type: "support/grant"; hours: GrantHours; at: number }
  | { type: "support/revoke"; at: number }
  | { type: "ticket/create"; ticket: NewTicket };

/** What the owner can change about a product. */
export type StockPatch = Partial<Pick<StockItem, "reorderAt" | "supplier" | "unitCost" | "salePrice">>;

/** A campaign as the studio builds it; the reducer adds id, status and first results. */
export type NewCampaign = Omit<Campaign, "id" | "status" | "stats" | "ad">;

/** A customer using the public booking page. `at` is the moment they acted, used for the owner's inbox. */
interface GuestContact {
  name: string;
  phone: string;
  email?: string;
}

export interface OnlineGuest extends GuestContact {
  at: { date: DateKey; time: number };
}

/** Owner-facing inbox text for an online action, written by the caller from the dictionary. */
export interface OnlineNotice {
  title: string;
  body: string;
  draftReply?: string;
}

const nextId = (state: DemoState, prefix: string) => `${prefix}-${state.seq}`;

function updateBy<T extends { id: string }>(list: T[], id: string, patch: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? patch(item) : item));
}

function createBooking(
  state: DemoState,
  input: { customerId: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource },
): DemoState {
  const service = state.services.find((s) => s.id === input.serviceId);
  if (!service || !service.staffIds.includes(input.staffId) || !isFree(state, input.staffId, input.date, input.start, needOf(service))) return state;
  const booking: Booking = {
    id: nextId(state, "b"),
    ...input,
    duration: service.duration,
    price: service.price,
    status: "booked",
    resourceId: pickResource(state, needOf(service), input.date, input.start),
  };
  return { ...state, seq: state.seq + 1, bookings: [...state.bookings, booking] };
}

function moveBooking(state: DemoState, id: string, date: DateKey, start: number, staffId?: StaffId): DemoState {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking) return state;
  const target = staffId ?? booking.staffId;
  if (!isFree(state, target, date, start, booking, id)) return state;
  const resourceId = pickResource(state, booking, date, start, id);
  return { ...state, bookings: updateBy(state.bookings, id, (b) => ({ ...b, date, start, staffId: target, resourceId })) };
}

/** The customer with this phone number, or a new one from the public booking page. */
function ensureCustomer(state: DemoState, guest: GuestContact, since: DateKey, category: Customer["category"], staffId: StaffId, waitlist: boolean): { state: DemoState; customer: Customer } {
  const existing = findCustomerByPhone(state, guest.phone);
  if (existing) {
    if (existing.waitlist || !waitlist) return { state, customer: existing };
    const customer = { ...existing, waitlist };
    return { state: { ...state, customers: updateBy(state.customers, existing.id, () => customer) }, customer };
  }
  const [firstName, ...rest] = guest.name.trim().split(/\s+/);
  const customer: Customer = {
    id: nextId(state, "k"),
    firstName,
    lastName: rest.join(" "),
    phone: guest.phone.trim(),
    email: guest.email?.trim() ?? "",
    category,
    preferredStaff: staffId,
    since,
    isRegular: false,
    tags: ["New"],
    waitlist,
  };
  return { state: { ...state, seq: state.seq + 1, customers: [...state.customers, customer] }, customer };
}

function bookOnline(state: DemoState, action: Extract<DemoAction, { type: "online/book" }>): DemoState {
  const service = bookableServices(state).find((s) => s.id === action.serviceId);
  if (!service || !service.staffIds.includes(action.staffId) || !action.guest.name.trim() || !isMobilePhone(action.guest.phone) || !isFree(state, action.staffId, action.date, action.start, needOf(service))) return state;
  const { state: withCustomer, customer } = ensureCustomer(state, action.guest, action.guest.at.date, service.category, action.staffId, false);
  const booked = createBooking(withCustomer, { customerId: customer.id, serviceId: service.id, staffId: action.staffId, date: action.date, start: action.start, source: "online" });
  const notified = reduce(booked, {
    type: "inbox/add",
    item: {
      kind: "request",
      customerId: customer.id,
      bookingId: booked.bookings[booked.bookings.length - 1].id,
      date: action.guest.at.date,
      time: action.guest.at.time,
      ...action.notice,
      read: false,
      handled: true,
    },
  });
  const bookingId = booked.bookings.at(-1)!.id;
  const confirmed = sendBookingMessage(notified, { type: "booking-message/send", bookingId, kind: "confirmation", channel: "sms", at: action.guest.at });
  return sendBookingMessage(confirmed, { type: "booking-message/send", bookingId, kind: "confirmation", channel: "email", at: action.guest.at });
}

function joinWaitlist(state: DemoState, action: Extract<DemoAction, { type: "online/waitlist" }>): DemoState {
  const service = bookableServices(state).find((s) => s.id === action.serviceId);
  if (!service || !action.guest.name.trim() || !isMobilePhone(action.guest.phone)) return state;
  if (action.staffId && !service.staffIds.includes(action.staffId)) return state;
  const { state: withCustomer, customer } = ensureCustomer(state, action.guest, action.guest.at.date, service.category, action.staffId ?? service.staffIds[0], true);
  return reduce(withCustomer, {
    type: "inbox/add",
    item: {
      kind: "request",
      customerId: customer.id,
      requestedStaffId: action.staffId,
      date: action.guest.at.date,
      time: action.guest.at.time,
      ...action.notice,
      read: false,
      handled: false,
    },
  });
}

/** Average full price of a campaign's treatments. */
function averagePrice(state: DemoState, serviceIds: string[]): number {
  const prices = state.services.filter((s) => serviceIds.includes(s.id)).map((s) => s.price);
  return prices.length ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
}

/** Publishing today starts the (simulated) results at once; a later day only plans the posts. */
function launchCampaign(state: DemoState, input: NewCampaign, today: DateKey): DemoState {
  if (!input.name.trim() || !input.channels.length || !input.publishOn) return state;
  const live = input.publishOn <= today;
  const campaign: Campaign = {
    ...input,
    id: nextId(state, "c"),
    status: live ? "active" : "planned",
    stats: live
      ? simulateStats({ seed: input.name, channels: input.channels, discountPercent: input.discountPercent, avgPrice: averagePrice(state, input.serviceIds) })
      : undefined,
  };
  if (live) sendDemoCampaign(campaign);
  return { ...state, seq: state.seq + 1, campaigns: [campaign, ...state.campaigns] };
}

/** One ad per campaign: its expected results are added to the campaign's numbers. */
function runAd(state: DemoState, id: string, ad: CampaignAd): DemoState {
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign?.stats || campaign.ad || ad.budget <= 0 || ad.days <= 0) return state;
  const stats = addAdResults(campaign.stats, ad, averagePrice(state, campaign.serviceIds), campaign.discountPercent);
  return { ...state, campaigns: updateBy(state.campaigns, id, (c) => ({ ...c, ad, stats })) };
}

/** A finished visit uses up what its treatment consumes (stock) and one visit of the customer's package, when those modules are on. */
function completeBooking(state: DemoState, id: string): DemoState {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking || booking.status !== "booked") return state;
  const done = { ...state, bookings: updateBy(state.bookings, id, (b) => ({ ...b, status: "completed" as const })) };
  const stocked = state.modules.stock ? { ...done, stock: deduct(done.stock, usesOfService(state, booking.serviceId)) } : done;
  return state.modules.packages ? consumePackageVisit(stocked, booking) : stocked;
}

function replyToInbox(state: DemoState, id: string, reply: string, slot?: SlotSuggestion): DemoState {
  const item = state.inbox.find((i) => i.id === id);
  if (!item) return state;
  let next = state;
  if (slot && item.kind === "reschedule" && item.bookingId) {
    next = moveBooking(next, item.bookingId, slot.date, slot.start, slot.staffId);
  } else if (slot && item.kind === "request") {
    let customerId = item.customerId;
    if (!customerId && item.fromName) {
      const [firstName, ...rest] = item.fromName.split(" ");
      const customer: Customer = {
        id: nextId(next, "k"),
        firstName,
        lastName: rest.join(" "),
        phone: item.body.match(/07\d-[\d ]+\d/)?.[0] ?? "",
        email: "",
        category: "foot",
        preferredStaff: slot.staffId,
        since: item.date,
        isRegular: false,
        tags: ["New"],
        waitlist: false,
      };
      customerId = customer.id;
      next = { ...next, seq: next.seq + 1, customers: [...next.customers, customer] };
    }
    if (customerId) next = createBooking(next, { ...slot, customerId, source: "online" });
  }
  return {
    ...next,
    inbox: updateBy(next.inbox, id, (i) => ({ ...i, reply, read: true, handled: true })),
    reviews: item.reviewId ? updateBy(next.reviews, item.reviewId, (r) => ({ ...r, reply })) : next.reviews,
  };
}

/** Adds imported customers, skipping any whose phone number is already known (or repeats within the list). */
function importCustomers(state: DemoState, incoming: Omit<Customer, "id">[]): DemoState {
  const known = new Set(state.customers.map((c) => normalizePhone(c.phone)));
  const added: Customer[] = [];
  for (const customer of incoming) {
    const phone = normalizePhone(customer.phone);
    if (phone.length < 7 || known.has(phone)) continue;
    known.add(phone);
    added.push({ ...customer, id: `k-${state.seq + added.length}` });
  }
  return added.length ? { ...state, seq: state.seq + added.length, customers: [...state.customers, ...added] } : state;
}

export function reduce(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "booking-message/send":
      return sendBookingMessage(state, action);
    case "review/submit":
    case "review/approve":
      return applyCustomerReview(state, action);
    case "salon/hours":
    case "salon/close":
    case "salon/reopen":
    case "staff/week":
    case "staff/off":
    case "staff/shift":
    case "staff/exception-remove":
    case "resource/add":
    case "resource/rename":
    case "resource/remove":
    case "service/resources":
      return applyOps(state, action);
    case "service/add":
    case "service/update":
    case "service/visibility":
    case "service/duplicate":
    case "service/delete":
    case "service/move":
    case "service/reorder":
    case "category/add":
    case "category/rename":
    case "category/remove":
    case "category/move":
    case "category/reorder":
      return applyServiceAction(state, action);
    case "memory/add":
    case "memory/edit":
    case "memory/forget":
    case "routine/add":
    case "routine/toggle":
    case "routine/ran":
    case "customers/message":
      return applyAssistant(state, action);
    case "page/set":
    case "salon/slug":
    case "domain/connect":
    case "domain/check":
    case "domain/remove":
      return applyPageAction(state, action);
    case "booking/move": {
      const moved = moveBooking(state, action.id, action.date, action.start, action.staffId);
      return action.notice && moved !== state ? reduce(moved, { type: "inbox/add", item: action.notice }) : moved;
    }
    case "booking/cancel": {
      const booking = state.bookings.find((b) => b.id === action.id);
      if (!booking || booking.status === "cancelled") return state;
      const marked = { ...state, bookings: updateBy(state.bookings, action.id, (b) => ({ ...b, status: "cancelled" as const, cancelReason: action.reason })) };
      const cancelled = booking.status === "booked" ? trashBooking(marked, action.id) : marked;
      // Only the owner's explicit offer texts the waiting list; a customer's own cancellation notice does not.
      if (action.notice?.waitlistOffer && booking.status === "booked" && state.modules.waitlist) textWaitlistAboutSlot(state, booking);
      return action.notice ? reduce(cancelled, { type: "inbox/add", item: action.notice }) : cancelled;
    }
    case "booking/create": {
      const { serviceId, staffId, date, start, source } = action;
      const input = { serviceId, staffId, date, start, source };
      if ("customerId" in action) {
        return state.customers.some((c) => c.id === action.customerId) ? createBooking(state, { ...input, customerId: action.customerId }) : state;
      }
      const service = state.services.find((s) => s.id === serviceId);
      const guest = action.newCustomer;
      if (!service || guest.name.trim().length < 2 || !isContactPhone(guest.phone)) return state;
      const next = ensureCustomer(state, guest, guest.since, service.category, staffId, false);
      const booked = createBooking(next.state, { ...input, customerId: next.customer.id });
      return booked === next.state ? state : booked;
    }
    case "online/book":
      return bookOnline(state, action);
    case "online/waitlist":
      return joinWaitlist(state, action);
    case "service/price":
      return { ...state, services: updateBy(state.services, action.id, (s) => ({ ...s, price: Math.max(0, Math.round(action.price)) })) };
    case "campaign/launch":
      return launchCampaign(state, action.campaign, action.today);
    case "campaign/ad":
      return runAd(state, action.id, action.ad);
    case "service/recall":
      return { ...state, services: updateBy(state.services, action.id, (s) => ({ ...s, recallWeeks: Math.min(MAX_INTERVAL_WEEKS, Math.max(MIN_INTERVAL_WEEKS, Math.round(action.weeks))) })) };
    case "customers/import":
      return importCustomers(state, action.customers);
    case "journal/edit":
      return { ...state, journals: updateBy(state.journals, action.id, (j) => editJournalEntry(j, action.content, action.on)) };
    case "journal/add":
      return { ...state, seq: state.seq + 1, journals: [...state.journals, { ...action.entry, id: nextId(state, "j") }] };
    case "stock/adjust":
      return { ...state, stock: updateBy(state.stock, action.id, (s) => ({ ...s, inStock: roundAmount(Math.max(0, s.inStock + action.delta)) })) };
    case "stock/update":
      return { ...state, stock: updateBy(state.stock, action.id, (s) => ({ ...s, ...action.patch })) };
    case "stock/order":
      return placeOrders(state, action.orders, action.at);
    case "stock/receive":
      return receiveGoods(state, action);
    case "product/sell":
      return sellProduct(state, action);
    case "giftcard/sell":
      return sellGiftCard(state, action);
    case "giftcard/redeem":
      return redeemGiftCard(state, action);
    case "package/sell":
      return sellPackage(state, action);
    case "booking/complete":
      return completeBooking(state, action.id);
    case "inbox/read":
      return { ...state, inbox: updateBy(state.inbox, action.id, (i) => ({ ...i, read: true })) };
    case "inbox/read-all":
      return { ...state, inbox: state.inbox.map((i) => ({ ...i, read: true })) };
    case "inbox/reply":
      return replyToInbox(state, action.id, action.reply, action.slot);
    case "inbox/add":
      return { ...state, seq: state.seq + 1, inbox: [{ ...action.item, id: nextId(state, "i") }, ...state.inbox] };
    case "review/reply":
      return { ...state, reviews: updateBy(state.reviews, action.id, (r) => ({ ...r, reply: action.reply })) };
    case "customer/note":
      return { ...state, customers: updateBy(state.customers, action.id, (c) => ({ ...c, note: action.note || undefined })) };
    case "cost/add": {
      const amount = Math.round(action.amount);
      const label = action.label.trim();
      if (!(amount > 0) || !label) return state;
      return { ...state, seq: state.seq + 1, costs: [...state.costs, { id: nextId(state, "cost"), kind: action.kind, label, amount }] };
    }
    case "cost/remove":
      return { ...state, costs: state.costs.filter((c) => c.id !== action.id) };
    case "accounting/connect":
      return { ...state, accounting: { connected: true, connectedOn: action.on } };
    case "accounting/disconnect":
      return { ...state, accounting: { connected: false } };
    case "module/toggle":
      return { ...state, modules: { ...state.modules, [action.key]: !state.modules[action.key] } };
    case "module/preset": {
      const modules = presetModules(action.preset);
      return MODULES.every((manifest) => state.modules[manifest.id] === modules[manifest.id]) ? state : { ...state, modules };
    }
    case "card/dismiss":
      return { ...state, dismissedCards: [...state.dismissedCards, action.id] };
    case "customer/delete":
      return deleteCustomer(state, action.id);
    case "trash/restore":
      return restoreEntry(state, action.id);
    case "log/undo":
      return undoEntry(state, action.id);
    case "support/grant":
      return grantSupport(state, action.hours, action.at);
    case "support/revoke":
      return revokeSupport(state, action.at);
    case "ticket/create":
      return { ...state, seq: state.seq + 1, tickets: [{ ...action.ticket, id: `tk-${state.seq}` }, ...state.tickets] };
  }
}
