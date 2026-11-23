import { addDays } from "../data/dates";
import { isActive, staffIntervals, timingOf } from "../data/slots";
import type { Booking, DateKey, DemoState, Interval, ResourceKind, Review, Salon, Service, Staff, StaffBlock, StaffException, StaffId, VisitTiming } from "../data/types";
import { EMPTY_ABOUT } from "../page/about";
import { normalizePage, showsAbout, type PageConfig } from "../page/config";
import { sanitizeCss } from "../page/css";
import { salonClock } from "../tools/clock";
import type { CheckoutHold } from "./protection";
import { DEFAULT_REMINDER_SETTINGS } from "./reminders";
import { publicName, recentReviews } from "./reviews";

// What the server may send to anyone who opens a salon's booking page. The
// result is a DemoState so the booking page and slots.ts run unchanged, but
// every value in it is read from the stored document through a leaf check
// (`text`, `num`, `list`): a field that is not listed, or not of the expected
// type, is dropped, and nested objects are never passed through. A key added
// to DemoState fails to compile until it is copied on purpose or emptied.
// Never send `publicView()` from the server; it only hides treatments.

/** How far ahead the booking page offers times; later days count as closed, and busy blocks stop there too. */
export const PUBLIC_WINDOW_DAYS = 28;

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const text = (value: unknown): string => typeof value === "string" ? value : "";
const optionalText = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const num = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** The preparation, clean-up and processing time of a treatment or visit, which decide when its staff member is busy. */
const timing = (stored: VisitTiming): VisitTiming => timingOf({
  bufferBefore: num(stored.bufferBefore), bufferAfter: num(stored.bufferAfter),
  processing: stored.processing ? { after: num(stored.processing.after), duration: num(stored.processing.duration) } : undefined,
});

const interval = (value: Interval | null | undefined): Interval | null => value ? { start: num(value.start), end: num(value.end) } : null;

const week = (stored: Record<number, Interval | null> | undefined): Record<number, Interval | null> =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, interval(stored?.[day])]));

const salon = (stored: Salon, bookableUntil: DateKey): Salon => ({
  name: text(stored.name), slug: text(stored.slug), tagline: text(stored.tagline), address: text(stored.address), area: text(stored.area),
  phone: text(stored.phone), email: text(stored.email), orgNumber: "",
  hours: Object.fromEntries(WEEKDAYS.map((day) => [day, stored.hours?.[day] ? { open: num(stored.hours[day].open), close: num(stored.hours[day].close) } : null])),
  lunch: stored.lunch ? { start: num(stored.lunch.start), end: num(stored.lunch.end) } : null,
  closures: (stored.closures ?? []).map((closure) => ({ id: text(closure.id), date: text(closure.date), name: "" })),
  bookableUntil,
});

const offering = (stored: Service): Service => ({
  id: text(stored.id), name: text(stored.name), category: text(stored.category), staffIds: list(stored.staffIds) as StaffId[],
  duration: num(stored.duration), price: num(stored.price), description: text(stored.description), details: optionalText(stored.details), recallWeeks: 0,
  image: optionalText(stored.image), resourceIds: list(stored.resourceIds), ...timing(stored),
});

/** A team member as the page shows them: first name and photo, and the title and bio only on cards. */
const teammate = (stored: Staff, cards: boolean): Staff => ({
  id: text(stored.id) as StaffId, photo: optionalText(stored.photo), firstName: text(stored.firstName), lastName: "", role: "",
  title: cards ? text(stored.title) : "", week: week(stored.week), bio: cards ? text(stored.bio) : "", phone: "",
});

/** A day off keeps its date but not its reason. */
const exception = (stored: StaffException): StaffException => {
  const own = { id: text(stored.id), staffId: text(stored.staffId) as StaffId, date: text(stored.date) };
  return stored.kind === "shift" ? { ...own, kind: "shift", start: num(stored.start), end: num(stored.end) } : { ...own, kind: "off", reason: "other" };
};

const block = (stored: StaffBlock): StaffBlock => ({
  id: text(stored.id), staffId: text(stored.staffId) as StaffId, date: text(stored.date), start: num(stored.start), end: num(stored.end), reason: "admin",
});

/** Someone else's visit, as the page needs it to hide the time: no customer, price or source. */
const busy = (stored: Booking, index: number): Booking => ({
  id: `busy-${index}`, customerId: "", staffId: text(stored.staffId) as StaffId, serviceId: "", date: text(stored.date), start: num(stored.start),
  duration: num(stored.duration), price: 0, status: "booked", source: "online", resourceId: optionalText(stored.resourceId),
  // A completed visit holds no preparation or clean-up (see `busyOn`): the page must hide exactly the times the store refuses.
  ...(stored.status === "completed" ? timing({ processing: stored.processing }) : timing(stored)),
});

/** A hold that frees its time when it expires, with nothing of the guest. */
const heldTime = (stored: CheckoutHold, index: number): CheckoutHold => ({
  id: `held-${index}`, serviceId: "", staffId: text(stored.staffId) as StaffId, date: text(stored.date), start: num(stored.start), duration: num(stored.duration),
  resourceId: optionalText(stored.resourceId), expiresAt: num(stored.expiresAt), ...timing(stored),
  terms: { version: 0, freeHours: 0, latePercent: 0, noShowPercent: 0, currency: "", priceMinor: 0, depositMinor: 0 },
  guest: { name: "", phone: "", at: { date: text(stored.date), time: 0 } },
  notice: { title: "", body: "" },
});

/**
 * Approved reviews, for the hero's rating and count. Text and author are sent
 * only for the ones the page's reviews section shows (never the owner's reply); without that
 * section the payload is ratings alone. No customer, staff or booking ids.
 */
function reviewsOf(state: DemoState, page: PageConfig): Review[] {
  if (!state.modules.reviews) return [];
  // Each review is checked before anything sorts or filters on it; one that is not well formed is skipped.
  const approved = state.reviews.filter((item) => item.approved === true && typeof item.text === "string" && typeof item.date === "string" &&
    Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5);
  const section = page.sections.find((candidate) => candidate.kind === "reviews");
  const shown = new Set(section ? recentReviews(approved, section.variant === "quote" ? 1 : 3) : []);
  return approved.map((item, index) => {
    const open = shown.has(item);
    const customer = open ? state.customers.find((c) => c.id === item.customerId) : undefined;
    return {
      id: `review-${index}`, customerId: "", staffId: "staff-0", date: text(item.date), rating: item.rating, text: open ? item.text : "",
      source: item.source === "Google" ? "Google" : "Booking page", approved: true,
      author: customer ? publicName(text(customer.firstName), text(customer.lastName)) : undefined,
    };
  });
}

export function publicSalonView(state: DemoState, now: Date): DemoState {
  const { today, minutes } = salonClock(now);
  const last = addDays(today, PUBLIC_WINDOW_DAYS);
  const inWindow = ({ date }: { date: DateKey }) => date >= today && date <= last;
  // A visit or hold that has already ended today, clean-up included, no longer occupies anything.
  const ended = (visit: { date: DateKey; start: number; duration: number } & VisitTiming) =>
    visit.date === today && Math.max(...staffIntervals(visit, visit.start, visit.duration).map((part) => part.end), visit.start + visit.duration) <= minutes;
  const page = normalizePage(state.page);
  const cards = page.sections.some((section) => section.kind === "staff" && section.variant !== "names");
  const services = state.services.filter((service) => !service.hidden).map(offering);
  const serviceIds = new Set(services.map((service) => service.id));
  const categoryIds = new Set(services.map((service) => service.category));
  const resourceIds = new Set(services.flatMap((service) => service.resourceIds ?? []));
  const policy = state.cancellationPolicy;
  return {
    version: num(state.version),
    generatedFor: text(state.generatedFor),
    seq: 0,
    pack: text(state.pack) as DemoState["pack"],
    industry: state.industry ? text(state.industry) as DemoState["industry"] : null,
    salon: salon(state.salon, last),
    localization: { language: state.localization.language === "sv" ? "sv" : "en", bilingual: state.localization.bilingual === true, currency: text(state.localization.currency) },
    cancellationPolicy: {
      version: num(policy.version), freeHours: num(policy.freeHours), latePercent: num(policy.latePercent), noShowPercent: num(policy.noShowPercent),
      deposits: Object.fromEntries(Object.entries(policy.deposits ?? {}).filter(([id, amount]) => serviceIds.has(id) && typeof amount === "number").map(([id, amount]) => [id, num(amount)])),
      newCustomersOnly: policy.newCustomersOnly === true, exemptServices: list(policy.exemptServices).filter((id) => serviceIds.has(id)),
    },
    // Only the reviews switch is the customer's to see; the rest of the studio's modules stay off here.
    modules: {
      journal: false, stock: false, campaigns: false, finance: false, reviews: state.modules.reviews === true, waitlist: false,
      assistant: false, giftcards: false, packages: false, domain: false,
    },
    // The owner's raw CSS stays on the server; the page gets the sanitised, scoped text.
    // An About text that customers do not see (section off, or no body yet) is a draft, so it stays on the server too.
    page: {
      ...page, css: "", sanitizedCss: sanitizeCss(page.css),
      sections: showsAbout(page) ? page.sections : page.sections.filter((section) => section.kind !== "about"),
      about: showsAbout(page) ? page.about : EMPTY_ABOUT,
    },
    categories: state.categories.filter((category) => categoryIds.has(category.id)).map((category) => ({ id: text(category.id), name: text(category.name) })),
    services,
    staff: state.staff.map((person) => teammate(person, cards)),
    resources: state.resources.filter((resource) => resourceIds.has(resource.id)).map((resource) => ({ id: text(resource.id), name: text(resource.name), kind: text(resource.kind) as ResourceKind })),
    exceptions: state.exceptions.filter(inWindow).map(exception),
    blocks: (state.blocks ?? []).filter(inWindow).map(block),
    bookings: state.bookings.filter((b) => isActive(b) && inWindow(b) && !ended(b)).map(busy),
    checkoutHolds: state.checkoutHolds.filter((hold) => hold.expiresAt > now.getTime() && inWindow(hold) && !ended(hold)).map(heldTime),
    reviews: reviewsOf(state, page),
    customers: [],
    retiredServices: [],
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    journals: [], stock: [], suppliers: [], orders: [], sales: [], giftCards: [], packages: [], inbox: [], holidays: [],
    campaigns: [], monthHistory: [], costs: [], accounting: { connected: false }, dismissedCards: [], log: [], trash: [],
    supportGrants: [], tickets: [], memory: [], routines: [], domain: null,
  };
}
