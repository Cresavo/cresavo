import { jsonEqual } from "./data/json-equal";
import { salonClock } from "./tools/clock";
import { depositMethods } from "./connections/ports/payments";
import { majorString } from "./connections/core";
import { quote, validPolicy, type BookingProtection, type BookingTerms, type CancellationPolicy, type DemoMethod } from "./booking/protection";
import { collect, decideFee, refundCancellation, type FeeDecision } from "./booking/settlement";
import { parseLocale } from "@/lib/locale";
import type { BusinessLocalization } from "./i18n/business";
import { sendBookingMessage, type BookingMessageAction } from "./booking/messages";
import { MAX_SMS_PRICE_ORE, type ReminderSettings } from "./booking/reminders";
import { applyCustomerReview, type CustomerReviewAction } from "./booking/review-actions";
import { applyAssistant, type AssistantAction } from "./assistant/actions";
import { findCustomerByPhone, isContactPhone, isMobilePhone, isNewCustomer, normalizePhone } from "./booking/lookup";
import { earliestOnlineStart, visitTime } from "./booking/policy";
import { addAdResults, simulateStats } from "./campaigns/simulate";
import { applyWaitlist, type WaitlistAction } from "./booking/waitlist-actions";
import { offerAvailable, validPreferences } from "./booking/waitlist-match";
import { advanceWaitlist, finishOffer, settleWaitlist } from "./booking/waitlist-offer";
import { ANY_TIME, type WaitlistEntry } from "./booking/waitlist-types";
import { demoPayments, sendDemoCampaign } from "./connections/demo";
import { editJournalEntry } from "./customers/journal";
import { MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "./customers/return-visits";
import type { CostKind } from "./finance/types";
import { isFree, needOf, pickResource, resourceStillFree, withSlotClock } from "./data/slots";
import { undoEntry } from "./log/undo";
import { bookableServices, inboxItemVisible } from "./selectors";
import { moduleById, moduleEnabled, moduleKeys, presetModules, type PresetId } from "./modules/registry";
import { applyOps, type OpsAction } from "./ops/edit";
import { applySalonDetails, type SalonDetails } from "./ops/salon-details";
import { applyServiceAction, validServicePrice, type ServiceAction } from "./services/edit";
import { applyPageAction, type PageAction } from "./page/actions";
import { grantSupport, revokeSupport, type GrantHours } from "./support/access";
import type { NewTicket } from "./support/tickets";
import { deleteCustomer, restoreEntry, trashBooking } from "./trash/trash";
import { eraseCustomer } from "./customers/erase";
import { placeOrders, receiveGoods, type Delivery, type NewOrder } from "./stock/orders";
import { redeemGiftCard, returnRedemptions, sellGiftCard } from "./giftcards/cards";
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
  | { type: "salon/language"; language: BusinessLocalization["language"]; bilingual: boolean }
  | { type: "salon/policy"; policy: CancellationPolicy }
  | { type: "salon/details"; details: Partial<SalonDetails> }
  | FeeDecision
  | { type: "online/hold"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId: StaffId; date: DateKey; start: number }
  | { type: "online/pay"; id: string; method: DemoMethod }
  | { type: "online/release"; id: string }
  | { type: "reminder/settings"; settings: Partial<ReminderSettings> }
  | BookingMessageAction
  | CustomerReviewAction
  | OpsAction
  | ServiceAction
  | AssistantAction
  | PageAction
  | WaitlistAction
  /** A customer books the time a personal waitlist offer holds for them (through checkout when a deposit is due). */
  /** `terms` is the price and policy the customer was shown; a claim on other terms is refused. */
  | { type: "online/claim"; id: string; terms: BookingTerms; notice: OnlineNotice }
  | { type: "booking/move"; id: string; date: DateKey; start: number; staffId?: StaffId; notice?: Omit<InboxItem, "id"> }
  /** `offerWaitingList`: the owner approves offering the freed time to the waiting list right away. */
  | { type: "booking/cancel"; id: string; reason?: string; notice?: Omit<InboxItem, "id">; offerWaitingList?: boolean }
  | ({
      type: "booking/create"; id?: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource;
    } & (
      | { customerId: string }
      | { newCustomer: GuestContact & { since: DateKey } }
      | { fictionalCustomer: { id: string; name: string; since: DateKey }; source: "assistant" }
    ))
  | { type: "online/book"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId: StaffId; date: DateKey; start: number }
  /** Without `days` the request is for the day of `guest.at`; without `window`, any time that day. */
  | { type: "online/waitlist"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId?: StaffId; days?: DateKey[]; window?: WaitlistEntry["window"] }
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
  /** Final erasure of a customer, live or in the trash (not undoable). The Postgres store runs it only through `eraseSubject`. */
  | { type: "customer/erase"; id: string }
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

function addInbox(state: DemoState, item: Omit<InboxItem, "id">): DemoState {
  return { ...state, seq: state.seq + 1, inbox: [{ ...item, id: nextId(state, "i") }, ...state.inbox] };
}

function updateBy<T extends { id: string }>(list: T[], id: string, patch: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? patch(item) : item));
}

function createBooking(
  state: DemoState,
  input: { id?: string; customerId: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource },
  protection?: BookingProtection,
  /** The room or chair already reserved for this visit (a checkout or an offer), kept when it is still free. */
  reserved?: string,
): DemoState {
  const service = state.services.find((s) => s.id === input.serviceId);
  if (!service || !service.staffIds.includes(input.staffId) || !isFree(state, input.staffId, input.date, input.start, needOf(service))) return state;
  if (input.id && state.bookings.some(b => b.id === input.id)) return state;
  const booking: Booking = {
    ...input,
    id: input.id ?? nextId(state, "b"),
    protection: protection ?? { terms: { ...quote(state.cancellationPolicy, service, state.localization.currency, false), depositMinor: 0 } },
    duration: service.duration,
    ...(service.bufferBefore ? { bufferBefore: service.bufferBefore } : {}),
    ...(service.bufferAfter ? { bufferAfter: service.bufferAfter } : {}),
    price: protection ? Number(majorString({ amountMinor: protection.terms.priceMinor, currency: protection.terms.currency })) : service.price,
    status: "booked",
    resourceId: reserved && resourceStillFree(state, needOf(service), reserved, input.date, input.start) ? reserved : pickResource(state, needOf(service), input.date, input.start),
  };
  return { ...state, seq: state.seq + 1, bookings: [...state.bookings, booking] };
}

function moveBooking(state: DemoState, id: string, date: DateKey, start: number, staffId?: StaffId): DemoState {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking || booking.protection?.decision || booking.protection?.refund) return state;
  const target = staffId ?? booking.staffId;
  if (!isFree(state, target, date, start, booking, id)) return state;
  const resourceId = pickResource(state, booking, date, start, id);
  return { ...state, bookings: updateBy(state.bookings, id, (b) => ({ ...b, date, start, staffId: target, resourceId })) };
}

/** The customer with this phone number, or a new one from the public booking page. */
function ensureCustomer(state: DemoState, guest: GuestContact, since: DateKey, category: Customer["category"], staffId: StaffId, waitlist: boolean, id?: string): { state: DemoState; customer: Customer } {
  const existing = findCustomerByPhone(state, guest.phone);
  if (existing) {
    if (existing.waitlist || !waitlist) return { state, customer: existing };
    const customer = { ...existing, waitlist };
    return { state: { ...state, customers: updateBy(state.customers, existing.id, () => customer) }, customer };
  }
  const [firstName, ...rest] = guest.name.trim().split(/\s+/);
  const customer: Customer = {
    id: id ?? nextId(state, "k"),
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
    ...(waitlist ? { waitlistProspect: true as const } : {}),
  };
  return { state: { ...state, seq: state.seq + 1, customers: [...state.customers, customer] }, customer };
}

/**
 * `resourceId`: a room or chair a personal offer or checkout already holds for this visit.
 * `customerId`: the customer a personal offer was made to; the booking is theirs and no one else's.
 */
type OnlineRequest = Extract<DemoAction, { type: "online/book" | "online/hold" }> & { resourceId?: string; customerId?: string };

/** The customer an online request is for: the offered one by id, otherwise whoever has the phone number. */
function requestCustomer(state: DemoState, action: Pick<OnlineRequest, "guest" | "customerId">) {
  return action.customerId ? state.customers.find(c => c.id === action.customerId) : findCustomerByPhone(state, action.guest.phone);
}

/** A booking from the public page must start at least the lead time after the customer acted. */
function withinLead(state: DemoState, action: OnlineRequest): boolean {
  const { at } = action.guest;
  const bufferBefore = state.services.find(s => s.id === action.serviceId)?.bufferBefore;
  return action.date >= at.date && action.start >= earliestOnlineStart(action.date, at.date, at.time, bufferBefore);
}

function bookOnline(state: DemoState, action: OnlineRequest, now: number): DemoState {
  const service = bookableServices(state).find(s => s.id === action.serviceId);
  if (!service || !service.staffIds.includes(action.staffId) || !action.guest.name.trim() || !isMobilePhone(action.guest.phone) || !isFree(state, action.staffId, action.date, action.start, needOf(service))) return state;
  if (action.customerId && !requestCustomer(state, action)) return state;
  const terms = quote(state.cancellationPolicy, service, state.localization.currency, isNewCustomer(state, requestCustomer(state, action)));
  // Preparation that has already begun is past, with or without a deposit; the guest's clock has whole minutes only.
  const preparation = visitTime({ date: action.date, start: action.start - (service.bufferBefore ?? 0) }).toMillis();
  if (preparation < now) return state;
  if (action.type === "online/book") return terms.depositMinor ? state : confirmOnline(state, action, service, { terms });
  if (!terms.depositMinor) return state;
  const { guest, notice, staffId, date, start } = action;
  // The checkout ends by the time preparation must begin; payment would be refused after that.
  if (preparation <= now) return state;
  const hold = {
    id: `hold-${now}-${state.seq}`, guest, notice, staffId, date, start, terms, duration: service.duration,
    ...(service.bufferBefore ? { bufferBefore: service.bufferBefore } : {}),
    ...(service.bufferAfter ? { bufferAfter: service.bufferAfter } : {}),
    resourceId: action.resourceId && resourceStillFree(state, needOf(service), action.resourceId, date, start) ? action.resourceId : pickResource(state, needOf(service), date, start),
    serviceId: service.id, expiresAt: Math.min(now + 10 * 60_000, preparation),
    ...(action.customerId ? { customerId: action.customerId } : {}),
  };
  return { ...state, seq: state.seq + 1, checkoutHolds: [...state.checkoutHolds.filter(h => h.expiresAt > now), hold] };
}

function payHold(state: DemoState, action: Extract<DemoAction, { type: "online/pay" }>, now: number, payments: typeof demoPayments) {
  const hold = state.checkoutHolds.find(h => h.id === action.id && h.expiresAt > now);
  if (!hold || !depositMethods(hold.terms.depositMinor, hold.terms.currency).includes(action.method)) return state;
  // Paying cannot confirm a visit whose preparation has already begun.
  if (visitTime({ date: hold.date, start: hold.start - (hold.bufferBefore ?? 0) }).toMillis() <= now) return state;
  const service = bookableServices(state).find(s => s.id === hold.serviceId && s.staffIds.includes(hold.staffId));
  // A checkout for a personal waitlist offer pays only while that offer still holds the time.
  const offer = hold.offerId ? state.waitlistOffers.find(o => o.id === hold.offerId) : undefined;
  if (hold.offerId && (!offer || !offerAvailable(state, offer, now))) return state;
  const released = {
    ...state,
    checkoutHolds: state.checkoutHolds.filter(h => h.id !== hold.id),
    waitlistOffers: offer ? state.waitlistOffers.filter(o => o !== offer) : state.waitlistOffers,
  };
  if (!service || service.duration !== hold.duration || (service.bufferBefore ?? 0) !== (hold.bufferBefore ?? 0) ||
      (service.bufferAfter ?? 0) !== (hold.bufferAfter ?? 0) || !isFree(released, hold.staffId, hold.date, hold.start, needOf(service))) return state;
  const id = collect(`${state.salon.slug}-${hold.id}-${hold.expiresAt}`, hold.terms.depositMinor, hold.terms.currency, "deposit", action.method, payments);
  if (!id) return state;
  const clock = salonClock(new Date(now));
  const guest = { ...hold.guest, at: { date: clock.today, time: clock.minutes } };
  const booked = confirmOnline(released, { ...hold, guest }, service, { terms: hold.terms, deposit: { id, method: action.method } });
  if (booked === released) return state;
  return offer ? finishOffer({ ...booked, waitlistOffers: state.waitlistOffers }, offer, "claimed", now, booked.bookings.at(-1)!.id) : booked;
}

function confirmOnline(state: DemoState, action: Omit<OnlineRequest, "type">, service: DemoState["services"][number], protection: BookingProtection): DemoState {
  const offered = action.customerId ? state.customers.find(c => c.id === action.customerId) : undefined;
  if (action.customerId && !offered) return state;
  const { state: withCustomer, customer } = offered ? { state, customer: offered } : ensureCustomer(state, action.guest, action.guest.at.date, service.category, action.staffId, false);
  const booked = createBooking(withCustomer, { customerId: customer.id, serviceId: service.id, staffId: action.staffId, date: action.date, start: action.start, source: "online" }, protection, action.resourceId);
  if (booked === withCustomer) return state;
  const notified = addInbox(booked, {
    kind: "request",
    customerId: customer.id,
    bookingId: booked.bookings[booked.bookings.length - 1].id,
    date: action.guest.at.date,
    time: action.guest.at.time,
    ...action.notice,
    read: false,
    handled: true,
  });
  const bookingId = booked.bookings.at(-1)!.id;
  const confirmed = sendBookingMessage(notified, { type: "booking-message/send", bookingId, kind: "confirmation", channel: "sms", at: action.guest.at });
  return sendBookingMessage(confirmed, { type: "booking-message/send", bookingId, kind: "confirmation", channel: "email", at: action.guest.at });
}

function joinWaitlist(state: DemoState, action: Extract<DemoAction, { type: "online/waitlist" }>, now: number): DemoState {
  const service = bookableServices(state).find((s) => s.id === action.serviceId);
  if (!state.modules.waitlist || !service || !action.guest.name.trim() || !isMobilePhone(action.guest.phone)) return state;
  if (action.staffId && !service.staffIds.includes(action.staffId)) return state;
  // `guest.at` is the moment the customer acted; stores replace it with their own clock (`withTrustedTimes`).
  const days = [...new Set(action.days ?? [action.guest.at.date])].sort();
  const window = action.window ?? ANY_TIME;
  if (!validPreferences(days, window, action.guest.at.date)) return state;
  const { state: withCustomer, customer } = ensureCustomer(state, action.guest, action.guest.at.date, service.category, action.staffId ?? service.staffIds[0], true);
  const theirs = withCustomer.waitlistEntries.filter(e => e.customerId === customer.id);
  if (theirs.some(e => e.serviceId === service.id && e.staffId === action.staffId && e.days.join() === days.join() &&
      e.window.start === window.start && e.window.end === window.end)) return state;
  // An older plain "waiting list" flag becomes this request and keeps its place in the queue.
  const legacy = theirs.filter(e => !e.serviceId);
  const entry: WaitlistEntry = {
    id: nextId(withCustomer, "wait"), customerId: customer.id, serviceId: service.id, ...(action.staffId ? { staffId: action.staffId } : {}),
    days, window: { start: window.start, end: window.end }, joinedAt: Math.min(now, ...legacy.map(e => e.joinedAt)),
  };
  const waitlistEntries = [...withCustomer.waitlistEntries.filter(e => !legacy.includes(e)), entry];
  return addInbox({ ...withCustomer, seq: withCustomer.seq + 1, waitlistEntries }, {
    kind: "request",
    customerId: customer.id,
    requestedStaffId: action.staffId,
    date: action.guest.at.date,
    time: action.guest.at.time,
    ...action.notice,
    read: false,
    handled: false,
  });
}

/** Books the time a personal offer holds, or opens its deposit checkout with the offer's own deadline. */
function claimOffer(state: DemoState, action: Extract<DemoAction, { type: "online/claim" }>, now: number): DemoState {
  const offer = state.waitlistOffers.find(o => o.id === action.id);
  if (!offer || state.checkoutHolds.some(h => h.offerId === offer.id)) return state;
  const customer = state.customers.find(c => c.id === offer.customerId);
  if (!customer || !state.waitlistEntries.some(e => e.id === offer.entryId) || !offerAvailable(state, offer, now)) return state;
  const service = bookableServices(state).find(s => s.id === offer.serviceId)!;
  const terms = quote(state.cancellationPolicy, service, state.localization.currency, isNewCustomer(state, customer));
  if (!jsonEqual(terms, action.terms)) return state;
  // The offer steps aside so its own hold does not block the booking it stands for.
  const released = { ...state, waitlistOffers: state.waitlistOffers.filter(o => o !== offer) };
  const clock = salonClock(new Date(now));
  const guest = { name: `${customer.firstName} ${customer.lastName}`.trim(), phone: customer.phone, at: { date: clock.today, time: clock.minutes } };
  const deposit = terms.depositMinor > 0;
  const request = { type: deposit ? "online/hold" as const : "online/book" as const, guest, notice: action.notice, serviceId: offer.serviceId, staffId: offer.staffId, date: offer.date, start: offer.start, resourceId: offer.resourceId, customerId: offer.customerId };
  const next = bookOnline(released, request, now);
  if (next === released) return state;
  if (deposit) {
    const created = next.checkoutHolds.at(-1)!;
    return { ...next, waitlistOffers: state.waitlistOffers, checkoutHolds: next.checkoutHolds.map(h => h === created ? { ...h, offerId: offer.id, expiresAt: offer.expiresAt } : h) };
  }
  return finishOffer({ ...next, waitlistOffers: state.waitlistOffers }, offer, "claimed", now, next.bookings.at(-1)!.id);
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
  return moduleEnabled(state.modules, "packages") ? consumePackageVisit(stocked, booking) : stocked;
}

function replyToInbox(state: DemoState, id: string, reply: string, slot?: SlotSuggestion): DemoState {
  const item = state.inbox.find((i) => i.id === id);
  if (!item || !inboxItemVisible(state, item) || (slot && item.handled)) return state;
  let next = state;
  if (slot && item.kind === "reschedule") {
    const booking = state.bookings.find(entry => entry.id === item.bookingId);
    if (booking?.status !== "booked") return state;
    next = moveBooking(next, booking.id, slot.date, slot.start, slot.staffId);
    if (next === state) return state;
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
    if (!customerId || !next.customers.some(customer => customer.id === customerId)) return state;
    const booked = createBooking(next, { ...slot, customerId, source: "online" });
    if (booked === next) return state;
    next = booked;
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

/** What the waiting list watches: a change to any of these may free time or end an offer. */
const WAITLIST_INPUTS = ["bookings", "salon", "staff", "exceptions", "services", "modules", "customers", "checkoutHolds", "waitlistEntries", "waitlistOffers", "waitlistGaps", "waitlistRules"] as const;

const settledAt = (state: DemoState, now: number) =>
  state.waitlistOffers.some(o => o.status === "offered" && o.expiresAt <= now) || state.waitlistGaps.some(g => g.readyAt !== undefined && g.readyAt <= now);

/**
 * Every change to the demo. After the change itself, the waiting list catches
 * up at the same instant (see `advanceWaitlist`): a time an action frees can be
 * offered in the same commit, and an action never sees a hold that has ended.
 */
// eslint-disable-next-line no-restricted-syntax -- Legacy direct callers use the wall clock; persistent stores pass their clock.
export function reduce(state: DemoState, action: DemoAction, now = Date.now(), payments = demoPayments): DemoState {
  return withSlotClock(now, () => {
    if (action.type === "waitlist/advance") return advanceWaitlist(state, state, now);
    // Holds that ran out end first; texts go out only after the action, so its withdrawals and pauses count.
    const overdue = settledAt(state, now);
    const base = overdue ? settleWaitlist(state, now) : state;
    const next = reduceCore(base, action, now, payments);
    if (next === base) return state;
    if (!overdue && WAITLIST_INPUTS.every(key => next[key] === base[key])) return next;
    const approve = action.type === "waitlist/offer" ? action.gapId : action.type === "booking/cancel" && action.offerWaitingList ? "released" : undefined;
    return advanceWaitlist(base, next, now, approve);
  });
}

function reduceCore(state: DemoState, action: DemoAction, now: number, payments: typeof demoPayments): DemoState {
  switch (action.type) {
    case "waitlist/rules":
    case "waitlist/offer":
    case "waitlist/advance":
    case "online/decline":
    case "online/leave":
      return applyWaitlist(state, action, now);
    case "online/claim":
      return claimOffer(state, action, now);
    case "salon/policy":
      if (!validPolicy(action.policy) || action.policy.version !== state.cancellationPolicy.version || jsonEqual(action.policy, state.cancellationPolicy)) return state;
      return { ...state, seq: state.seq + 1, cancellationPolicy: { ...action.policy, version: state.seq + 1 } };
    case "booking/fee":
      return decideFee(state, action, now, payments);
    case "online/pay":
      return payHold(state, action, now, payments);
    case "online/release": {
      const hold = state.checkoutHolds.find(h => h.id === action.id);
      if (!hold) return state;
      // Leaving the checkout of a personal offer passes the time on to the next customer.
      const offer = hold.offerId ? state.waitlistOffers.find(o => o.id === hold.offerId && o.status === "offered") : undefined;
      if (offer) return finishOffer(state, offer, offer.expiresAt > now ? "declined" : "lapsed", now);
      return { ...state, checkoutHolds: state.checkoutHolds.filter(h => h.id !== action.id) };
    }
    case "salon/details":
      return applySalonDetails(state, action.details);
    case "salon/language": {
      const language = parseLocale(action.language);
      if (!language || typeof action.bilingual !== "boolean") return state;
      if (state.localization.language === language && state.localization.bilingual === action.bilingual) return state;
      return { ...state, localization: { ...state.localization, language, bilingual: action.bilingual } };
    }
    case "booking-message/send":
      return sendBookingMessage(state, action);
    case "reminder/settings": {
      const { channel, smsPriceOre } = { ...state.reminderSettings, ...action.settings };
      if (channel !== "sms" && channel !== "email") return state;
      if (!Number.isInteger(smsPriceOre) || smsPriceOre < 0 || smsPriceOre > MAX_SMS_PRICE_ORE) return state;
      if (channel === state.reminderSettings.channel && smsPriceOre === state.reminderSettings.smsPriceOre) return state;
      return { ...state, reminderSettings: { channel, smsPriceOre } };
    }
    case "review/submit":
    case "review/approve":
      return applyCustomerReview(state, action);
    case "salon/hours":
    case "salon/close":
    case "salon/reopen":
    case "staff/block":
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
      return action.notice && moved !== state ? addInbox(moved, action.notice) : moved;
    }
    case "booking/cancel": {
      const booking = state.bookings.find((b) => b.id === action.id);
      if (!booking || booking.status === "cancelled" || booking.protection?.decision || (booking.protection?.deposit && booking.status !== "booked")) return state;
      const refunded = refundCancellation(booking, payments);
      if (!refunded) return state;
      const giftCards = refunded.protection?.refund ? returnRedemptions(state.giftCards, new Set([booking.id])) : state.giftCards;
      const marked = { ...state, giftCards, bookings: updateBy(state.bookings, action.id, () => ({ ...refunded, status: "cancelled" as const, cancelReason: action.reason })) };
      const cancelled = booking.status === "booked" && !refunded.protection?.refund ? trashBooking(marked, action.id) : marked;
      return action.notice ? addInbox(cancelled, action.notice) : cancelled;
    }
    case "booking/create": {
      const { serviceId, staffId, date, start, source } = action;
      const input = { id: action.id, serviceId, staffId, date, start, source };
      if ("customerId" in action) {
        return state.customers.some((c) => c.id === action.customerId) ? createBooking(state, { ...input, customerId: action.customerId }) : state;
      }
      const service = state.services.find((s) => s.id === serviceId);
      const fictional = "fictionalCustomer" in action ? action.fictionalCustomer : undefined;
      if (fictional && state.customers.some(c => c.id === fictional.id)) return state;
      const guest = "newCustomer" in action ? action.newCustomer : { ...action.fictionalCustomer, phone: "" };
      if (!service || guest.name.trim().length < 2 || (!fictional && !isContactPhone(guest.phone))) return state;
      const next = ensureCustomer(state, guest, guest.since, service.category, staffId, false, fictional?.id);
      const booked = createBooking(next.state, { ...input, customerId: next.customer.id });
      return booked === next.state ? state : booked;
    }
    case "online/book":
    case "online/hold":
      return withinLead(state, action) ? bookOnline(state, action, now) : state;
    case "online/waitlist":
      return joinWaitlist(state, action, now);
    case "service/price":
      if (!validServicePrice(action.price)) return state;
      return { ...state, services: updateBy(state.services, action.id, (s) => ({ ...s, price: action.price })) };
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
      return { ...state, inbox: state.inbox.map((i) => inboxItemVisible(state, i) ? { ...i, read: true } : i) };
    case "inbox/reply":
      return replyToInbox(state, action.id, action.reply, action.slot);
    case "inbox/add":
      return addInbox(state, action.item);
    case "review/reply":
      if (!state.modules.reviews || !state.reviews.some((review) => review.id === action.id)) return state;
      return {
        ...state,
        reviews: updateBy(state.reviews, action.id, (review) => ({ ...review, reply: action.reply })),
        inbox: state.inbox.map((item) => item.reviewId === action.id ? { ...item, reply: action.reply, read: true, handled: true } : item),
      };
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
    case "module/toggle": {
      const enabled = !moduleEnabled(state.modules, action.key);
      const modules = { ...state.modules };
      for (const key of moduleKeys(moduleById(action.key))) modules[key] = enabled;
      return { ...state, modules };
    }
    case "module/preset": {
      const modules = presetModules(action.preset);
      return (Object.keys(modules) as ModuleKey[]).every((key) => state.modules[key] === modules[key]) ? state : { ...state, modules };
    }
    case "card/dismiss":
      return state.dismissedCards.includes(action.id) ? state : { ...state, dismissedCards: [...state.dismissedCards, action.id] };
    case "customer/delete":
      return deleteCustomer(state, action.id);
    case "customer/erase":
      return eraseCustomer(state, action.id);
    case "trash/restore":
      return restoreEntry(state, action.id, payments);
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
