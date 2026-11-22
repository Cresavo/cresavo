import { addDays } from "../data/dates";
import type { Booking, DateKey, DemoState, Interval, Review, Salon, Service, Staff, StaffBlock, StaffException } from "../data/types";
import { normalizePage } from "../page/config";
import { salonClock } from "../tools/clock";
import { publicName } from "./reviews";
import { DEFAULT_REMINDER_SETTINGS } from "./reminders";
import type { CheckoutHold } from "./protection";

// What the server may send to anyone who opens a salon's booking page. The
// result is a DemoState so the booking page and slots.ts run unchanged, but
// every object in it is built from explicit public fields, never spread from
// the stored one: a field added to a stored type, or smuggled into the stored
// document, stays private until it is listed here. A key added to DemoState
// fails to compile until it is copied on purpose or emptied. Never send
// `publicView()` from the server; it only hides treatments.

/** How far ahead the booking page offers times; busy blocks stop there too. */
export const PUBLIC_WINDOW_DAYS = 28;

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const interval = (value: Interval | null | undefined): Interval | null => value ? { start: value.start, end: value.end } : null;

const week = (stored: Record<number, Interval | null>): Record<number, Interval | null> =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, interval(stored[day])]));

const salon = (stored: Salon): Salon => ({
  name: stored.name, slug: stored.slug, tagline: stored.tagline, address: stored.address, area: stored.area,
  phone: stored.phone, email: stored.email, orgNumber: "",
  hours: Object.fromEntries(WEEKDAYS.map((day) => [day, stored.hours[day] ? { open: stored.hours[day].open, close: stored.hours[day].close } : null])),
  lunch: stored.lunch ? { start: stored.lunch.start, end: stored.lunch.end } : null,
  closures: stored.closures.map(({ id, date }) => ({ id, date, name: "" })),
});

const offering = (stored: Service): Service => ({
  id: stored.id, name: stored.name, category: stored.category, staffIds: [...stored.staffIds], duration: stored.duration,
  price: stored.price, description: stored.description, recallWeeks: 0, image: stored.image, resourceIds: stored.resourceIds && [...stored.resourceIds],
});

/** A team member as the page shows them: first name and photo, and the title and bio only on cards. */
const teammate = (stored: Staff, cards: boolean): Staff => ({
  id: stored.id, photo: stored.photo, firstName: stored.firstName, lastName: "", role: "", title: cards ? stored.title : "",
  week: week(stored.week), bio: cards ? stored.bio : "", phone: "",
});

/** A day off keeps its date but not its reason. */
const exception = (stored: StaffException): StaffException => stored.kind === "off"
  ? { id: stored.id, staffId: stored.staffId, date: stored.date, kind: "off", reason: "other" }
  : { id: stored.id, staffId: stored.staffId, date: stored.date, kind: "shift", start: stored.start, end: stored.end };

const block = (stored: StaffBlock): StaffBlock => ({ id: stored.id, staffId: stored.staffId, date: stored.date, start: stored.start, end: stored.end, reason: "admin" });

/** Someone else's visit, as the page needs it to hide the time: no customer, price or source. */
const busy = (stored: Booking, index: number): Booking => ({
  id: `busy-${index}`, customerId: "", staffId: stored.staffId, serviceId: "", date: stored.date, start: stored.start,
  duration: stored.duration, price: 0, status: "booked", source: "online", resourceId: stored.resourceId,
});

/** A hold that frees its time when it expires, with nothing of the guest. */
const heldTime = (stored: CheckoutHold, index: number): CheckoutHold => ({
  id: `held-${index}`, serviceId: "", staffId: stored.staffId, date: stored.date, start: stored.start, duration: stored.duration,
  resourceId: stored.resourceId, expiresAt: stored.expiresAt,
  terms: { version: 0, freeHours: 0, latePercent: 0, noShowPercent: 0, currency: "", priceMinor: 0, depositMinor: 0 },
  guest: { name: "", phone: "", at: { date: stored.date, time: 0 } },
  notice: { title: "", body: "" },
});

/** Only reviews the owner approved, by display name: no customer, staff or booking id. */
function reviewsOf(state: DemoState): Review[] {
  if (!state.modules.reviews) return [];
  return state.reviews.filter((item) => item.approved === true).map((item, index) => {
    const customer = state.customers.find((c) => c.id === item.customerId);
    return {
      id: `review-${index}`, customerId: "", staffId: "staff-0", date: item.date, rating: item.rating, text: item.text,
      source: item.source, approved: true, reply: item.reply, author: customer ? publicName(customer.firstName, customer.lastName) : "",
    };
  });
}

export function publicSalonView(state: DemoState, now: Date): DemoState {
  const today = salonClock(now).today;
  const last = addDays(today, PUBLIC_WINDOW_DAYS);
  const inWindow = ({ date }: { date: DateKey }) => date >= today && date <= last;
  const page = normalizePage(state.page);
  const cards = page.sections.some((section) => section.kind === "staff" && section.variant !== "names");
  return {
    version: state.version,
    generatedFor: state.generatedFor,
    seq: 0,
    pack: state.pack,
    industry: state.industry,
    salon: salon(state.salon),
    localization: { language: state.localization.language, bilingual: state.localization.bilingual, currency: state.localization.currency },
    cancellationPolicy: {
      version: state.cancellationPolicy.version, freeHours: state.cancellationPolicy.freeHours, latePercent: state.cancellationPolicy.latePercent,
      noShowPercent: state.cancellationPolicy.noShowPercent, deposits: { ...state.cancellationPolicy.deposits },
      newCustomersOnly: state.cancellationPolicy.newCustomersOnly, exemptServices: [...state.cancellationPolicy.exemptServices],
    },
    // Only the reviews switch is the customer's to see; the rest of the studio's modules stay off here.
    modules: {
      journal: false, stock: false, campaigns: false, finance: false, reviews: state.modules.reviews, waitlist: false,
      assistant: false, giftcards: false, packages: false, domain: false,
    },
    page,
    categories: state.categories.map(({ id, name }) => ({ id, name })),
    services: state.services.filter((service) => !service.hidden).map(offering),
    staff: state.staff.map((person) => teammate(person, cards)),
    resources: state.resources.map(({ id, name, kind }) => ({ id, name, kind })),
    exceptions: state.exceptions.filter(inWindow).map(exception),
    blocks: (state.blocks ?? []).filter(inWindow).map(block),
    bookings: state.bookings.filter((b) => b.status === "booked" && inWindow(b)).map(busy),
    checkoutHolds: state.checkoutHolds.filter((hold) => hold.expiresAt > now.getTime() && inWindow(hold)).map(heldTime),
    reviews: reviewsOf(state),
    customers: [],
    retiredServices: [],
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    journals: [], stock: [], suppliers: [], orders: [], sales: [], giftCards: [], packages: [], inbox: [], holidays: [],
    campaigns: [], monthHistory: [], costs: [], accounting: { connected: false }, dismissedCards: [], log: [], trash: [],
    supportGrants: [], tickets: [], memory: [], routines: [], domain: null,
  };
}
