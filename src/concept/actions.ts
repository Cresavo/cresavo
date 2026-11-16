import { isFree } from "./data/slots";
import type {
  Booking,
  BookingSource,
  Campaign,
  Customer,
  DateKey,
  DemoState,
  InboxItem,
  JournalEntry,
  ModuleKey,
  SlotSuggestion,
  StaffId,
} from "./data/types";

// Every change to the demo goes through this pure reducer. Buttons use it
// today; the command box and AI suggestions will dispatch the same actions.

export type DemoAction =
  | { type: "booking/move"; id: string; date: DateKey; start: number; staffId?: StaffId }
  | { type: "booking/cancel"; id: string; reason?: string; notice?: Omit<InboxItem, "id"> }
  | { type: "booking/create"; customerId: string; serviceId: string; staffId: StaffId; date: DateKey; start: number; source: BookingSource }
  | { type: "service/price"; id: string; price: number }
  | { type: "campaign/create"; campaign: Omit<Campaign, "id"> }
  | { type: "journal/add"; entry: Omit<JournalEntry, "id"> }
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

export function reduce(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "booking/move":
      return moveBooking(state, action.id, action.date, action.start, action.staffId);
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
    case "service/price":
      return { ...state, services: updateBy(state.services, action.id, (s) => ({ ...s, price: Math.max(0, Math.round(action.price)) })) };
    case "campaign/create":
      return { ...state, seq: state.seq + 1, campaigns: [{ ...action.campaign, id: nextId(state, "c") }, ...state.campaigns] };
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
