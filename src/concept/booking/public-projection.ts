import type { Booking, Customer, DemoState, Review, Service, Staff, StaffException, StaffId } from "../data/types";
import { isActive } from "../data/slots";
import { DEFAULT_REMINDER_SETTINGS } from "./reminders";

// What the server may send to anyone who opens a salon's booking page. The
// result is a DemoState so the booking page and slots.ts run unchanged, but it
// is built field by field: a key added to DemoState fails to compile here until
// it is either copied on purpose or emptied. Never send `publicView()` from the
// server; it only hides treatments.

/** Someone else's visit, as the page needs it to hide the time: no customer, price or source. */
const busy = ({ staffId, date, start, duration, resourceId }: Pick<Booking, "staffId" | "date" | "start" | "duration" | "resourceId">, index: number): Booking => ({
  id: `busy-${index}`, customerId: "", staffId, serviceId: "", date, start, duration, price: 0, status: "booked", source: "online", resourceId,
});

const offering = (service: Service): Service => ({ ...service, consumption: undefined });

const teammate = (person: Staff): Staff => ({ ...person, phone: "" });

/** A day off keeps its date but not its reason. */
const exception = (item: StaffException): StaffException => item.kind === "off" ? { ...item, reason: "other" } : item;

/** A reviewer is known by first name and initial, as the page prints it. */
const reviewer = ({ id, firstName, lastName }: Customer, preferredStaff: StaffId): Customer => ({
  id, firstName, lastName: lastName.slice(0, 1), phone: "", email: "", category: "both",
  preferredStaff, since: "", isRegular: false, tags: [], waitlist: false,
});

const review = (item: Review): Review => ({ ...item, bookingId: undefined });

export function publicSalonView(state: DemoState): DemoState {
  const reviews = state.reviews.filter((item) => item.approved !== false).map(review);
  const reviewers = new Map<string, Customer>();
  for (const { customerId, staffId } of reviews) {
    const customer = state.customers.find((c) => c.id === customerId);
    if (customer) reviewers.set(customerId, reviewer(customer, staffId));
  }
  return {
    version: state.version,
    generatedFor: state.generatedFor,
    seq: 0,
    pack: state.pack,
    industry: state.industry,
    salon: { ...state.salon, orgNumber: "", closures: state.salon.closures.map((closure) => ({ ...closure, name: "" })) },
    localization: state.localization,
    cancellationPolicy: state.cancellationPolicy,
    modules: state.modules,
    page: state.page,
    categories: state.categories,
    services: state.services.filter((service) => !service.hidden).map(offering),
    staff: state.staff.map(teammate),
    resources: state.resources,
    exceptions: state.exceptions.map(exception),
    blocks: (state.blocks ?? []).map(({ id, staffId, date, start, end }) => ({ id, staffId, date, start, end, reason: "admin" as const })),
    bookings: [...state.bookings.filter(isActive), ...state.checkoutHolds].map(busy),
    reviews,
    customers: [...reviewers.values()],
    checkoutHolds: [],
    retiredServices: [],
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    journals: [], stock: [], suppliers: [], orders: [], sales: [], giftCards: [], packages: [], inbox: [], holidays: [],
    campaigns: [], monthHistory: [], costs: [], accounting: { connected: false }, dismissedCards: [], log: [], trash: [],
    supportGrants: [], tickets: [], memory: [], routines: [], domain: null,
  };
}
