import { jsonEqual } from "./data/json-equal";
import { salonClock } from "./tools/clock";
import { depositMethods } from "./connections/ports/payments";
import { majorString } from "./connections/core";
import { quote, unknownPolicyServices, validPolicy, type BookingProtection, type CancellationPolicy, type DemoMethod } from "./booking/protection";
import { collect, decideFee, refundCancellation, type FeeDecision } from "./booking/settlement";
import { parseLocale } from "@/lib/locale";
import { t } from "./i18n";
import { formatDayLong, formatTime } from "./i18n/format";
import type { BusinessLocalization } from "./i18n/business";
import { sendBookingMessage, type BookingMessageAction } from "./booking/messages";
import { MAX_SMS_PRICE_ORE, type ReminderSettings } from "./booking/reminders";
import { applyCustomerReview, type CustomerReviewAction } from "./booking/review-actions";
import { applyAssistant, type AssistantAction } from "./assistant/actions";
import { findCustomerByPhone, isContactPhone, isMobilePhone, normalizePhone } from "./booking/lookup";
import { cleanImportedCustomer, MAX_IMPORT_ROWS, normalizeEmail } from "./customers/csv";
import { earliestBookingStart, freeChangeOpen, LEAD_MINUTES, visitTime } from "./booking/policy";
import { PUBLIC_WINDOW_DAYS } from "./booking/public-projection";
import { acceptedTerms, type AcceptedTerms } from "./booking/public-terms";
import { addDays } from "./data/dates";
import { cleanSignOff } from "./campaigns/channels";
import { addAdResults, simulateStats } from "./campaigns/simulate";
import { textWaitlistAboutSlot } from "./booking/waitlist-offer";
import { demoPayments, sendDemoCampaign } from "./connections/demo";
import { editJournalEntry } from "./customers/journal";
import { MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "./customers/return-visits";
import type { CostKind } from "./finance/types";
import { isFree, needOf, pickResource, timingOf } from "./data/slots";
import { undoEntry } from "./log/undo";
import { bookableServices, findCustomer, findService, fullName, inboxItemVisible } from "./selectors";
import { moduleById, moduleEnabled, moduleKeys, presetModules, type PresetId } from "./modules/registry";
import { applyOps, type OpsAction } from "./ops/edit";
import { applySalonDetails, type SalonDetails } from "./ops/salon-details";
import { applyServiceAction, validServicePrice, type ServiceAction } from "./services/edit";
import { applyPageAction, type PageAction } from "./page/actions";
import { grantSupport, revokeSupport, type GrantHours } from "./support/access";
import type { NewTicket } from "./support/tickets";
import { deleteCustomer, restoreEntry, trashBooking } from "./trash/trash";
import { eraseCustomer } from "./customers/erase";
import { keepCustomer, updateBooking, updateCustomer, type BookingPatch, type CustomerPatch } from "./customers/rights";
import { recordJournalView, type JournalViewAction } from "./privacy/journal-access";
import { validJournalYears } from "./privacy/review";
import { placeOrders, receiveGoods, type Delivery, type NewOrder } from "./stock/orders";
import { paidWithCards, redeemGiftCard, returnRedemptions, sellGiftCard } from "./giftcards/cards";
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
  VisitTiming,
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
  | { type: "booking/move"; id: string; date: DateKey; start: number; staffId?: StaffId; notice?: Omit<InboxItem, "id"> }
  | { type: "booking/cancel"; id: string; reason?: string; notice?: Omit<InboxItem, "id"> }
  | ({
      type: "booking/create"; id?: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource;
    } & (
      | { customerId: string }
      | { newCustomer: GuestContact & { since: DateKey } }
      | { fictionalCustomer: { id: string; name: string; since: DateKey }; source: "assistant" }
    ))
  | { type: "online/book"; guest: OnlineGuest; notice?: OnlineNotice; serviceId: string; staffId: StaffId; date: DateKey; start: number; public?: PublicBooking }
  | { type: "online/cancel"; id: string; at: OnlineGuest["at"]; instant: number; public: PublicChange; expected: ExpectedVisit }
  | { type: "online/move"; id: string; at: OnlineGuest["at"]; instant: number; public: PublicChange; expected: ExpectedVisit; staffId: StaffId; date: DateKey; start: number }
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
  /** Correction of a customer's card (GDPR art. 16): any subset of its personal fields. */
  | { type: "customer/update"; id: string; patch: CustomerPatch }
  /** Correction of the personal text fields of a visit: the address typed on the booking page, a note, a cancellation reason. */
  | { type: "booking/update"; id: string; patch: BookingPatch }
  /** The owner reviewed a customer due under the retention rules and keeps them. */
  | { type: "customer/keep"; id: string; on: DateKey }
  /** One read of a journal, logged without its content. Without a customer: a load that delivered every journal. */
  | ({ type: "journal/view" } & JournalViewAction)
  | { type: "privacy/journal-retention"; years: number | null }
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

/**
 * What makes an `online/book` a booking from a salon's public page: the page
 * the guest was on, the terms they accepted and the opaque reference of the
 * receipt. The reducer refuses it unless both still hold, and treats every
 * such guest as a new customer for deposits (a phone number proves nothing).
 * Without `notice` the inbox text is written here, in the salon's language.
 */
export interface PublicBooking {
  slug: string;
  terms: AcceptedTerms;
  publicRef: string;
}

/** The visit as the customer saw it when they chose to change it; a change is refused if the booking is no longer that. */
export interface ExpectedVisit {
  date: DateKey;
  start: number;
  staffId: StaffId;
}

/**
 * What makes an `online/cancel` or `online/move` a change by the holder of a
 * booking link: the page it came from. The route has checked the link; the
 * reducer decides whether the customer may still change the booking.
 */
export interface PublicChange {
  slug: string;
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

/** Ids a new customer or booking may not take: those in the salon and those in the restorable trash. */
function takenIds(state: DemoState, kind: "customers" | "bookings"): Set<string> {
  const held = state.trash.flatMap((entry) => (entry.kind !== "customer" ? [] : kind === "customers" ? [entry.customer.id] : entry.bookings.map((b) => b.id)));
  return new Set([...state[kind].map((item) => item.id), ...held]);
}

/** `prefix-N` for the first N from the running number on that nothing holds. The one way a customer or booking gets its id. */
function freeId(taken: ReadonlySet<string>, seq: number, prefix: string): string {
  let n = seq;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

function updateBy<T extends { id: string }>(list: T[], id: string, patch: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? patch(item) : item));
}

function createBooking(
  state: DemoState,
  input: { id?: string; customerId: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource; contactEmail?: string; publicRef?: string },
  protection?: BookingProtection,
  /** The timing the slot was checked with; a paid hold keeps the one it reserved. */
  timing?: VisitTiming,
): { state: DemoState; booking: Booking } | null {
  const service = state.services.find((s) => s.id === input.serviceId);
  if (!service || !service.staffIds.includes(input.staffId)) return null;
  const need = { serviceId: service.id, duration: service.duration, ...(timing ?? timingOf(service)) };
  if (!isFree(state, input.staffId, input.date, input.start, need)) return null;
  const taken = takenIds(state, "bookings");
  if (input.id && taken.has(input.id)) return null;
  const booking: Booking = {
    id: input.id ?? freeId(taken, state.seq, "b"),
    customerId: input.customerId,
    serviceId: service.id,
    staffId: input.staffId,
    date: input.date,
    start: input.start,
    source: input.source,
    protection: protection ?? { terms: { ...quote(state.cancellationPolicy, service, state.localization.currency, false), depositMinor: 0 } },
    duration: service.duration,
    ...timingOf(need),
    price: protection ? Number(majorString({ amountMinor: protection.terms.priceMinor, currency: protection.terms.currency })) : service.price,
    status: "booked",
    resourceId: pickResource(state, need, input.date, input.start),
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
    ...(input.publicRef ? { publicRef: input.publicRef } : {}),
  };
  return { state: { ...state, seq: state.seq + 1, bookings: [...state.bookings, booking] }, booking };
}

function moveBooking(state: DemoState, id: string, date: DateKey, start: number, staffId?: StaffId): DemoState {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking || booking.protection?.decision || booking.protection?.refund) return state;
  const target = staffId ?? booking.staffId;
  const service = [...state.services, ...state.retiredServices].find(s => s.id === booking.serviceId);
  if (target !== booking.staffId && !service?.staffIds.includes(target)) return state;
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
    id: id ?? freeId(takenIds(state, "customers"), state.seq, "k"),
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

type OnlineRequest = Extract<DemoAction, { type: "online/book" | "online/hold" }>;

/** Upcoming online bookings one phone number may hold at a salon, so one number cannot fill the book. */
export const MAX_UPCOMING_ONLINE_PER_PHONE = 3;

/** Visits that have not ended yet by the trusted clock count; earlier ones today do not. */
function atOnlineLimit(state: DemoState, phone: string, at: OnlineGuest["at"]): boolean {
  const wanted = normalizePhone(phone);
  const owners = new Set(state.customers.filter((c) => normalizePhone(c.phone) === wanted).map((c) => c.id));
  const upcoming = (b: Booking) => b.date > at.date || (b.date === at.date && b.start + b.duration > at.time);
  return state.bookings.filter((b) => owners.has(b.customerId) && b.source === "online" && b.status === "booked" && upcoming(b)).length >= MAX_UPCOMING_ONLINE_PER_PHONE;
}

function bookOnline(state: DemoState, action: OnlineRequest, now: number): DemoState {
  const { at } = action.guest;
  if (action.date < at.date || action.date > addDays(at.date, PUBLIC_WINDOW_DAYS) || action.start < earliestBookingStart(action.date, at.date, at.time)) return state;
  if (action.type === "online/book" && atOnlineLimit(state, action.guest.phone, at)) return state;
  const service = bookableServices(state).find(s => s.id === action.serviceId);
  if (!service || !service.staffIds.includes(action.staffId) || !action.guest.name.trim() || !isMobilePhone(action.guest.phone) || !isFree(state, action.staffId, action.date, action.start, needOf(service))) return state;
  const publicBooking = action.type === "online/book" ? action.public : undefined;
  if (publicBooking && (publicBooking.slug !== state.salon.slug || !jsonEqual(publicBooking.terms, acceptedTerms(state, service)))) return state;
  const terms = quote(state.cancellationPolicy, service, state.localization.currency, publicBooking ? true : !findCustomerByPhone(state, action.guest.phone));
  if (action.type === "online/book") {
    if (terms.depositMinor) return state;
    const notice = action.notice ?? { title: t("booking.inboxTitle"), body: t("booking.inboxBody", { service: service.name, staff: state.staff.find((s) => s.id === action.staffId)?.firstName ?? "", day: formatDayLong(action.date), time: formatTime(action.start) }) };
    return confirmOnline(state, { ...action, notice, publicRef: publicBooking?.publicRef }, service, { terms });
  }
  if (!terms.depositMinor) return state;
  const { guest, notice, staffId, date, start } = action;
  const hold = {
    id: `hold-${now}-${state.seq}`, guest, notice, staffId, date, start, terms, duration: service.duration, ...timingOf(service),
    resourceId: pickResource(state, needOf(service), date, start), serviceId: service.id, expiresAt: now + 10 * 60_000,
  };
  return { ...state, seq: state.seq + 1, checkoutHolds: [...state.checkoutHolds.filter(h => h.expiresAt > now), hold] };
}

/** Why a guest cannot change a booking from its link: it is not theirs to change online, it is no longer the visit they saw, or the free-cancellation deadline has passed (or money is involved) and the salon must be called. */
export type OnlineChangeBlock = "not_changeable" | "changed" | "call_salon";

/**
 * Whether the holder of a booking link may still cancel or move it by themselves,
 * decided at the store's trusted `instant`: a booked visit of this salon that is
 * still the one they saw, before the deadline of the terms it was booked under,
 * and free of any payment (a deposit, a fee or a gift card is the salon's to
 * settle). Nothing is ever charged or refunded here.
 */
export function onlineChangeBlock(state: DemoState, id: string, slug: string, instant: number, expected?: ExpectedVisit): OnlineChangeBlock | undefined {
  const booking = state.bookings.find((b) => b.id === id);
  const paid = booking?.protection?.deposit || booking?.protection?.decision || booking?.protection?.refund;
  if (!booking || slug !== state.salon.slug || !booking.publicRef || booking.status !== "booked" || !findCustomer(state, booking.customerId)) return "not_changeable";
  if (expected && (expected.date !== booking.date || expected.start !== booking.start || expected.staffId !== booking.staffId)) return "changed";
  return paid || paidWithCards(state, booking.id) || !freeChangeOpen(booking, instant) ? "call_salon" : undefined;
}

function changeOnline(state: DemoState, action: Extract<DemoAction, { type: "online/cancel" | "online/move" }>, now: number): DemoState {
  const { id, at } = action;
  const booking = state.bookings.find((b) => b.id === id);
  const customer = findCustomer(state, booking?.customerId);
  if (!booking || !customer || onlineChangeBlock(state, id, action.public.slug, action.instant, action.expected)) return state;
  const service = findService(state, booking.serviceId);
  const name = fullName(customer);
  const when = (visit: Pick<Booking, "date" | "start">) => `${formatDayLong(visit.date)} ${formatTime(visit.start)}`;
  const notice = (kind: "cancel" | "reschedule", title: string, body: string) =>
    ({ kind, customerId: customer.id, bookingId: id, date: at.date, time: at.time, title, body, read: false, handled: kind === "reschedule" });
  // Each change is its own message: the counter tells a move back to a time the visit had before from the first one.
  const mail = (next: DemoState, kind: "cancellation" | "moved") => sendBookingMessage(next, { type: "booking-message/send", bookingId: id, kind, channel: "email", at, occasion: next.seq });
  if (action.type === "online/cancel") {
    const cancelled = reduce(state, {
      type: "booking/cancel", id, reason: t("booking.cancel.reason"),
      notice: notice("cancel", t("booking.cancel.inboxTitle"), t("booking.cancel.inboxBody", { name, service: service?.name ?? "", when: when(booking) })),
    }, now);
    return cancelled === state ? state : mail(cancelled, "cancellation");
  }
  const { staffId, date, start } = action;
  const bookable = bookableServices(state).find((s) => s.id === booking.serviceId);
  const same = staffId === booking.staffId && date === booking.date && start === booking.start;
  if (same || !bookable?.staffIds.includes(staffId) || date < at.date || date > addDays(at.date, PUBLIC_WINDOW_DAYS) || visitTime({ date, start }).toMillis() < action.instant + LEAD_MINUTES * 60_000) return state;
  const moved = moveBooking(state, id, date, start, staffId);
  if (moved === state) return state;
  const noted = reduce(moved, { type: "inbox/add", item: notice("reschedule", t("booking.move.inboxTitle"), t("booking.move.inboxBody", { name, service: service?.name ?? "", from: when(booking), to: when({ date, start }) })) });
  return mail(noted, "moved");
}

function payHold(state: DemoState, action: Extract<DemoAction, { type: "online/pay" }>, now: number, payments: typeof demoPayments) {
  const hold = state.checkoutHolds.find(h => h.id === action.id && h.expiresAt > now);
  if (!hold || !depositMethods(hold.terms.depositMinor, hold.terms.currency).includes(action.method)) return state;
  const service = bookableServices(state).find(s => s.id === hold.serviceId && s.staffIds.includes(hold.staffId));
  const released = { ...state, checkoutHolds: state.checkoutHolds.filter(h => h.id !== hold.id) };
  if (!service || service.duration !== hold.duration || !isFree(released, hold.staffId, hold.date, hold.start, hold)) return state;
  const id = collect(`${state.salon.slug}-${hold.id}-${hold.expiresAt}`, hold.terms.depositMinor, hold.terms.currency, "deposit", action.method, payments);
  if (!id) return state;
  const clock = salonClock(new Date(now));
  const guest = { ...hold.guest, at: { date: clock.today, time: clock.minutes } };
  return confirmOnline(released, { ...hold, guest }, service, { terms: hold.terms, deposit: { id, method: action.method } }, timingOf(hold));
}

type OnlineConfirmation = Pick<OnlineRequest, "guest" | "staffId" | "date" | "start"> & { notice: OnlineNotice; publicRef?: string };

function confirmOnline(state: DemoState, action: OnlineConfirmation, service: DemoState["services"][number], protection: BookingProtection, timing?: VisitTiming): DemoState {
  const { state: withCustomer, customer } = ensureCustomer(state, action.guest, action.guest.at.date, service.category, action.staffId, false);
  const created = createBooking(withCustomer, { customerId: customer.id, serviceId: service.id, staffId: action.staffId, date: action.date, start: action.start, source: "online", contactEmail: action.guest.email?.trim(), publicRef: action.publicRef }, protection, timing);
  if (!created) return state;
  const bookingId = created.booking.id;
  const notified = reduce(created.state, {
    type: "inbox/add",
    item: {
      kind: "request",
      customerId: customer.id,
      bookingId,
      date: action.guest.at.date,
      time: action.guest.at.time,
      ...action.notice,
      read: false,
      handled: true,
    },
  });
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
  const signOff = cleanSignOff(input.signOff);
  const campaign: Campaign = {
    ...input,
    signOff,
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
        id: freeId(takenIds(next, "customers"), next.seq, "k"),
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
    if (!booked) return state;
    next = booked.state;
  }
  return {
    ...next,
    inbox: updateBy(next.inbox, id, (i) => ({ ...i, reply, read: true, handled: true })),
    reviews: item.reviewId ? updateBy(next.reviews, item.reviewId, (r) => ({ ...r, reply })) : next.reviews,
  };
}

/** Adds imported customers, rebuilt from their allowed fields. Invalid records are skipped, and so is any whose phone number or e-mail is already known (or repeats within the list). */
function importCustomers(state: DemoState, incoming: Omit<Customer, "id">[]): DemoState {
  const known = new Set(state.customers.map((c) => normalizePhone(c.phone)));
  const knownEmails = new Set(state.customers.map((c) => normalizeEmail(c.email)).filter(Boolean));
  const staff = state.staff.map((s) => s.id);
  const taken = takenIds(state, "customers");
  const added: Customer[] = [];
  for (const raw of Array.isArray(incoming) ? incoming.slice(0, MAX_IMPORT_ROWS) : []) {
    const customer = raw && typeof raw === "object" ? cleanImportedCustomer(raw, staff) : null;
    if (!customer) continue;
    const phone = normalizePhone(customer.phone);
    if (known.has(phone) || (customer.email && knownEmails.has(customer.email))) continue;
    known.add(phone);
    if (customer.email) knownEmails.add(customer.email);
    const id = freeId(taken, state.seq, "k");
    taken.add(id);
    added.push({ ...customer, id });
  }
  return added.length ? { ...state, seq: state.seq + added.length, customers: [...state.customers, ...added] } : state;
}

// eslint-disable-next-line no-restricted-syntax -- Legacy direct callers use the wall clock; persistent stores pass their clock.
export function reduce(state: DemoState, action: DemoAction, now = Date.now(), payments = demoPayments): DemoState {
  switch (action.type) {
    case "salon/policy":
      if (!validPolicy(action.policy) || action.policy.version !== state.cancellationPolicy.version || jsonEqual(action.policy, state.cancellationPolicy)) return state;
      if (unknownPolicyServices(state.cancellationPolicy, action.policy, state.services).length) return state;
      return { ...state, seq: state.seq + 1, cancellationPolicy: { ...action.policy, version: state.seq + 1 } };
    case "booking/fee":
      return decideFee(state, action, now, payments);
    case "online/pay":
      return payHold(state, action, now, payments);
    case "online/release":
      return state.checkoutHolds.some(h => h.id === action.id) ? { ...state, checkoutHolds: state.checkoutHolds.filter(h => h.id !== action.id) } : state;
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
      return action.notice && moved !== state ? reduce(moved, { type: "inbox/add", item: action.notice }) : moved;
    }
    case "booking/cancel": {
      const booking = state.bookings.find((b) => b.id === action.id);
      if (!booking || booking.status === "cancelled" || booking.protection?.decision || (booking.protection?.deposit && booking.status !== "booked")) return state;
      const refunded = refundCancellation(booking, payments);
      if (!refunded) return state;
      const giftCards = refunded.protection?.refund ? returnRedemptions(state.giftCards, new Set([booking.id])) : state.giftCards;
      const marked = { ...state, giftCards, bookings: updateBy(state.bookings, action.id, () => ({ ...refunded, status: "cancelled" as const, cancelReason: action.reason })) };
      const cancelled = booking.status === "booked" && !refunded.protection?.refund ? trashBooking(marked, action.id) : marked;
      // Only the owner's explicit offer texts the waiting list; a customer's own cancellation notice does not.
      if (action.notice?.waitlistOffer && booking.status === "booked" && state.modules.waitlist) textWaitlistAboutSlot(state, booking);
      return action.notice ? reduce(cancelled, { type: "inbox/add", item: action.notice }) : cancelled;
    }
    case "booking/create": {
      const { serviceId, staffId, date, start, source } = action;
      const input = { id: action.id, serviceId, staffId, date, start, source };
      if ("customerId" in action) {
        return state.customers.some((c) => c.id === action.customerId) ? createBooking(state, { ...input, customerId: action.customerId })?.state ?? state : state;
      }
      const service = state.services.find((s) => s.id === serviceId);
      const fictional = "fictionalCustomer" in action ? action.fictionalCustomer : undefined;
      if (fictional && takenIds(state, "customers").has(fictional.id)) return state;
      const guest = "newCustomer" in action ? action.newCustomer : { ...action.fictionalCustomer, phone: "" };
      if (!service || guest.name.trim().length < 2 || (!fictional && !isContactPhone(guest.phone))) return state;
      const next = ensureCustomer(state, guest, guest.since, service.category, staffId, false, fictional?.id);
      const booked = createBooking(next.state, { ...input, customerId: next.customer.id });
      return booked?.state ?? state;
    }
    case "online/book":
    case "online/hold":
      return bookOnline(state, action, now);
    case "online/cancel":
    case "online/move":
      return changeOnline(state, action, now);
    case "online/waitlist":
      return joinWaitlist(state, action);
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
    case "journal/add": {
      const { customerId, staffId, bookingId } = action.entry;
      if (!state.customers.some(c => c.id === customerId) || !state.staff.some(s => s.id === staffId)) return state;
      if (bookingId && state.bookings.find(b => b.id === bookingId)?.customerId !== customerId) return state;
      return { ...state, seq: state.seq + 1, journals: [...state.journals, { ...action.entry, id: nextId(state, "j") }] };
    }
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
      return { ...state, seq: state.seq + 1, inbox: [{ ...action.item, id: nextId(state, "i") }, ...state.inbox] };
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
    case "customer/update":
      return updateCustomer(state, action.id, action.patch);
    case "booking/update":
      return updateBooking(state, action.id, action.patch);
    case "customer/keep":
      return keepCustomer(state, action.id, now);
    case "journal/view":
      return recordJournalView(state, action, now);
    case "privacy/journal-retention":
      if (!validJournalYears(action.years) || (state.privacy?.journalRetentionYears ?? null) === action.years) return state;
      return { ...state, privacy: { ...state.privacy, journalRetentionYears: action.years } };
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
      return { ...state, seq: state.seq + 1, tickets: [{ ...action.ticket, createdAt: now, id: `tk-${state.seq}` }, ...state.tickets] };
  }
}
