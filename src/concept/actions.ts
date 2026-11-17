import { findCustomerByPhone, normalizePhone } from "./booking/lookup";
import { addAdResults, simulateStats } from "./campaigns/simulate";
import { editJournalEntry } from "./customers/journal";
import { MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "./customers/return-visits";
import { isFree } from "./data/slots";
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
} from "./data/types";

// Every change to the demo goes through this pure reducer. Buttons use it
// today; the command box and AI suggestions will dispatch the same actions.

export type DemoAction =
  | { type: "booking/move"; id: string; date: DateKey; start: number; staffId?: StaffId; notice?: Omit<InboxItem, "id"> }
  | { type: "booking/cancel"; id: string; reason?: string; notice?: Omit<InboxItem, "id"> }
  | { type: "booking/create"; customerId: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource }
  | { type: "online/book"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string; staffId: StaffId; date: DateKey; start: number }
  | { type: "online/waitlist"; guest: OnlineGuest; notice: OnlineNotice; serviceId: string }
  | { type: "service/price"; id: string; price: number }
  | { type: "campaign/launch"; campaign: NewCampaign; today: DateKey }
  | { type: "campaign/ad"; id: string; ad: CampaignAd }
  | { type: "journal/add"; entry: Omit<JournalEntry, "id"> }
  | { type: "journal/edit"; id: string; content: JournalContent; on: DateKey }
  | { type: "service/recall"; id: string; weeks: number }
  | { type: "customers/import"; customers: Omit<Customer, "id">[] }
  | { type: "stock/adjust"; id: string; delta: number }
  | { type: "stock/order"; lines: { id: string; quantity: number }[] }
  | { type: "inbox/read"; id: string }
  | { type: "inbox/read-all" }
  | { type: "inbox/reply"; id: string; reply: string; slot?: SlotSuggestion }
  | { type: "inbox/add"; item: Omit<InboxItem, "id"> }
  | { type: "review/reply"; id: string; reply: string }
  | { type: "customer/note"; id: string; note: string }
  | { type: "module/toggle"; key: ModuleKey }
  | { type: "card/dismiss"; id: string };

/** A campaign as the studio builds it; the reducer adds id, status and first results. */
export type NewCampaign = Omit<Campaign, "id" | "status" | "stats" | "ad">;

/** A customer using the public booking page. `at` is the moment they acted, used for the owner's inbox. */
export interface OnlineGuest {
  name: string;
  phone: string;
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
  if (!service || !isFree(state, input.staffId, input.date, input.start, service.duration)) return state;
  const booking: Booking = {
    id: nextId(state, "b"),
    ...input,
    duration: service.duration,
    price: service.price,
    status: "booked",
  };
  return { ...state, seq: state.seq + 1, bookings: [...state.bookings, booking] };
}

function moveBooking(state: DemoState, id: string, date: DateKey, start: number, staffId?: StaffId): DemoState {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking) return state;
  const target = staffId ?? booking.staffId;
  if (!isFree(state, target, date, start, booking.duration, id)) return state;
  return { ...state, bookings: updateBy(state.bookings, id, (b) => ({ ...b, date, start, staffId: target })) };
}

/** The customer with this phone number, or a new one from the public booking page. */
function ensureOnlineCustomer(state: DemoState, guest: OnlineGuest, category: Customer["category"], staffId: StaffId, waitlist: boolean): { state: DemoState; customer: Customer } {
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
    email: "",
    category,
    preferredStaff: staffId,
    since: guest.at.date,
    isRegular: false,
    tags: ["New"],
    waitlist,
  };
  return { state: { ...state, seq: state.seq + 1, customers: [...state.customers, customer] }, customer };
}

function bookOnline(state: DemoState, action: Extract<DemoAction, { type: "online/book" }>): DemoState {
  const service = state.services.find((s) => s.id === action.serviceId);
  if (!service || !action.guest.name.trim() || !isFree(state, action.staffId, action.date, action.start, service.duration)) return state;
  const { state: withCustomer, customer } = ensureOnlineCustomer(state, action.guest, service.category, action.staffId, false);
  const booked = createBooking(withCustomer, { customerId: customer.id, serviceId: service.id, staffId: action.staffId, date: action.date, start: action.start, source: "online" });
  return reduce(booked, {
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
}

function joinWaitlist(state: DemoState, action: Extract<DemoAction, { type: "online/waitlist" }>): DemoState {
  const service = state.services.find((s) => s.id === action.serviceId);
  if (!service || !action.guest.name.trim()) return state;
  const { state: withCustomer, customer } = ensureOnlineCustomer(state, action.guest, service.category, service.staffIds[0], true);
  return reduce(withCustomer, {
    type: "inbox/add",
    item: {
      kind: "request",
      customerId: customer.id,
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
  return { ...state, seq: state.seq + 1, campaigns: [campaign, ...state.campaigns] };
}

/** One ad per campaign: its expected results are added to the campaign's numbers. */
function runAd(state: DemoState, id: string, ad: CampaignAd): DemoState {
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign?.stats || campaign.ad || ad.budget <= 0 || ad.days <= 0) return state;
  const stats = addAdResults(campaign.stats, ad, averagePrice(state, campaign.serviceIds), campaign.discountPercent);
  return { ...state, campaigns: updateBy(state.campaigns, id, (c) => ({ ...c, ad, stats })) };
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
    case "booking/move": {
      const moved = moveBooking(state, action.id, action.date, action.start, action.staffId);
      return action.notice && moved !== state ? reduce(moved, { type: "inbox/add", item: action.notice }) : moved;
    }
    case "booking/cancel": {
      const cancelled = { ...state, bookings: updateBy(state.bookings, action.id, (b) => ({ ...b, status: "cancelled" as const, cancelReason: action.reason })) };
      return action.notice ? reduce(cancelled, { type: "inbox/add", item: action.notice }) : cancelled;
    }
    case "booking/create":
      return createBooking(state, {
        customerId: action.customerId,
        serviceId: action.serviceId,
        staffId: action.staffId,
        date: action.date,
        start: action.start,
        source: action.source,
      });
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
      return { ...state, stock: updateBy(state.stock, action.id, (s) => ({ ...s, inStock: Math.max(0, s.inStock + action.delta) })) };
    case "stock/order":
      return {
        ...state,
        stock: state.stock.map((s) => {
          const line = action.lines.find((l) => l.id === s.id);
          return line ? { ...s, onOrder: s.onOrder + line.quantity } : s;
        }),
      };
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
    case "module/toggle":
      return { ...state, modules: { ...state.modules, [action.key]: !state.modules[action.key] } };
    case "card/dismiss":
      return { ...state, dismissedCards: [...state.dismissedCards, action.id] };
  }
}
