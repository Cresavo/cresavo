import { DEFAULT_POLICY } from "../booking/protection";
import type { Locale } from "@/lib/locale";
import { DEFAULT_REMINDER_SETTINGS } from "../booking/reminders";
import { addDays, WEEK_ORDER } from "../data/dates";
import { openingFor } from "../data/slots";
import { DEMO_VERSION, MODULE_KEYS } from "../data/generate";
import type { Booking, Customer, DateKey, DemoState, PackId, Salon, Staff } from "../data/types";
import { translate, type MessageKey } from "../i18n";
import { DEFAULT_BOOKING_LANGUAGE, DEFAULT_CURRENCY } from "../i18n/business";
import { checkOwnSlug } from "../page/address";
import { DEFAULT_PAGE } from "../page/config";
import { DEFAULT_THEME, normalizeTheme, PALETTES, type PhotoId } from "../page/theme";
import { slugify } from "../page/slug";
import { getPack } from "../packs";
import { weekFromHours } from "../ops/edit";
import { applyServiceAction, DURATION_STEP, MAX_DURATION, MAX_NAME, MIN_DURATION, validServicePrice, type ServiceDraft } from "../services/edit";

// Every industry a saved salon can carry. Setup offers the six in SETUP_TYPES; the
// others stay valid for salons made with an earlier version of setup.
export const INDUSTRIES = ["hair", "beauty", "nails", "lashes", "massage", "skin", "foot", "clinic", "other"] as const;
export type Industry = typeof INDUSTRIES[number];
export const SETUP_TYPES = ["hair", "beauty", "nails", "lashes", "massage", "skin"] as const satisfies readonly Industry[];
export type SetupType = typeof SETUP_TYPES[number];
const packs: Record<Industry, PackId> = {
  hair: "hair", beauty: "nails", nails: "nails", lashes: "nails", skin: "nails", foot: "foot-massage",
  massage: "foot-massage", clinic: "clinic", other: "foot-massage",
};

/** The calm booking-page colours setup offers; null keeps the neutral look that follows light and dark. */
export const SETUP_ACCENTS = ["forest", "sand", "linen"] as const satisfies readonly (keyof typeof PALETTES)[];
/** Accents setup used to offer; still accepted when a saved draft is restored. */
const SETUP_ACCENTS_SAVED = ["forest", "sand", "linen", "rose", "sky"] as const satisfies readonly (keyof typeof PALETTES)[];
export type SetupAccent = typeof SETUP_ACCENTS_SAVED[number];

/** One example cover per setup type, plus a foot-care photo used as a treatment thumb. */
export const SETUP_COVERS = {
  hair: "exampleHair", beauty: "exampleBeauty", nails: "exampleNails", lashes: "exampleLashes",
  massage: "exampleMassage", skin: "exampleSkin", foot: "exampleFeet", clinic: "exampleSkin", other: "exampleBeauty",
} as const satisfies Record<Industry, PhotoId>;

export const setupCover = (industry: Industry): PhotoId => SETUP_COVERS[industry];

/** Relevant example thumbs for a type, starting with its cover. Only as many as we have; the rest stay unset. */
const SETUP_TREATMENT_PHOTOS: Record<Industry, PhotoId[]> = {
  hair: ["exampleHair"],
  beauty: ["exampleBeauty", "exampleSkin"],
  nails: ["exampleNails"],
  lashes: ["exampleLashes"],
  massage: ["exampleMassage", "exampleFeet"],
  skin: ["exampleSkin", "exampleBeauty"],
  foot: ["exampleFeet", "exampleMassage"],
  clinic: ["exampleSkin"],
  other: ["exampleBeauty"],
};

export function setupTreatmentPhotos(industry: Industry, count: number): Array<PhotoId | undefined> {
  const pool = SETUP_TREATMENT_PHOTOS[industry];
  return Array.from({ length: count }, (_, i) => pool[i]);
}


export type Treatment = Pick<ServiceDraft, "name" | "duration" | "price">;
export interface SalonDraft {
  name: string;
  industry: Industry;
  language: Locale;
  currency: string;
  hours: Salon["hours"];
  treatments: Treatment[];
  /** The owner first (may be blank), then colleagues. Blank colleagues are left out. */
  people: string[];
  slug: string;
  /** The booking page's colours, or null for the neutral look. */
  accent: SetupAccent | null;
  /** A small logo as a data URL (see `readLogo`), or null for the leaf mark. */
  logo: string | null;
}

/** Setup takes the owner and up to five colleagues; more people are added later under Staff. */
export const MAX_PEOPLE = 6;
export const MAX_PERSON_NAME = 60;
const DAY = 24 * 60;

/** Every open day starts before it ends, within the day, on whole minutes. */
export function hoursValid(hours: Salon["hours"]): boolean {
  return WEEK_ORDER.every(day => {
    const span = hours[day];
    return span === null || span === undefined || (Number.isInteger(span.open) && Number.isInteger(span.close) && span.open >= 0 && span.close <= DAY && span.open < span.close);
  });
}

/** The same hours on the given days, closed on the rest. */
export function sameHours(days: number[], open: number, close: number): Salon["hours"] {
  return Object.fromEntries(WEEK_ORDER.map(day => [day, days.includes(day) ? { open, close } : null]));
}

export function weeklyHours(saturday = false): Salon["hours"] {
  return Object.fromEntries(WEEK_ORDER.map(day => [day, day >= (saturday ? 2 : 1) && day <= (saturday ? 6 : 5)
    ? { open: saturday ? 600 : 540, close: saturday ? 1080 : 1020 } : null]));
}

/** Typical treatments per salon type: minutes and a usual Swedish price in SEK. Names come from `setup.<type><n>`. */
const suggestions: Record<Industry, [number, number][]> = {
  hair: [[45, 650], [120, 1650], [30, 450], [30, 395]],
  beauty: [[60, 895], [20, 295], [30, 395], [45, 550]],
  nails: [[45, 495], [60, 595], [90, 895], [60, 650]],
  lashes: [[60, 695], [120, 1295], [60, 695], [45, 595]],
  massage: [[60, 795], [30, 495], [75, 995], [60, 895]],
  skin: [[60, 895], [45, 995], [30, 550], [60, 850]],
  foot: [[50, 650], [30, 400]],
  clinic: [[45, 800], [30, 550]],
  other: [[30, 400], [60, 750]],
};

export function suggestedTreatments(industry: Industry, language: Locale): Treatment[] {
  return suggestions[industry].map(([duration, price], i) => ({
    name: translate(language, `setup.${industry}${i + 1}` as MessageKey), duration, price,
  }));
}

export type TreatmentIssue = "name" | "nameTaken" | "price" | "duration";

/** What stops a setup treatment from being saved, using the same limits as the price list. */
export function treatmentIssue(list: Treatment[], index: number): TreatmentIssue | null {
  const item = list[index];
  const name = item.name.trim().toLocaleLowerCase();
  if (!name || name.length > MAX_NAME) return "name";
  if (list.some((other, i) => i !== index && other.name.trim().toLocaleLowerCase() === name)) return "nameTaken";
  if (!Number.isFinite(item.price) || !validServicePrice(item.price)) return "price";
  if (!Number.isInteger(item.duration) || item.duration < MIN_DURATION || item.duration > MAX_DURATION || item.duration % DURATION_STEP) return "duration";
  return null;
}

export const treatmentsValid = (list: Treatment[]) => list.every((_, i) => !treatmentIssue(list, i));

export function salonDraft(language: Locale = DEFAULT_BOOKING_LANGUAGE): SalonDraft {
  return { name: "", industry: "hair", language, currency: DEFAULT_CURRENCY, hours: weeklyHours(),
    people: [""], treatments: suggestedTreatments("hair", language), slug: "", accent: null, logo: null };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A cleared number input is saved as `null` (JSON has no NaN); it comes back as still missing, not as zero. */
const savedNumber = (value: unknown) => typeof value === "number" ? value : NaN;

/** Every day is closed or has whole-minute times within the day, in either order. */
const editableHours = (hours: Salon["hours"]) => WEEK_ORDER.every(day => {
  const span = hours[day];
  return span === null || (Number.isInteger(span.open) && Number.isInteger(span.close) && span.open >= 0 && span.close <= DAY && span.open <= DAY && span.close >= 0);
});

/**
 * A draft read back from the browser: anything missing or malformed takes the default, so a draft saved by an
 * earlier setup (name, type and treatments only) or by another version still opens.
 */
export function restoreDraft(input: unknown, language: Locale): SalonDraft {
  const base = salonDraft(language);
  if (!isObject(input)) return base;
  const industry = INDUSTRIES.includes(input.industry as Industry) ? input.industry as Industry : base.industry;
  const saved: Locale = input.language === "sv" || input.language === "en" ? input.language : base.language;
  const hours = isObject(input.hours) ? Object.fromEntries(WEEK_ORDER.map(day => {
    const span = (input.hours as Record<string, unknown>)[day];
    return [day, isObject(span) ? { open: span.open, close: span.close } : null];
  })) as Salon["hours"] : base.hours;
  const treatments = Array.isArray(input.treatments) && input.treatments.every(item => isObject(item) && typeof item.name === "string")
    ? (input.treatments as Record<string, unknown>[]).map(item => ({ name: String(item.name), price: savedNumber(item.price), duration: savedNumber(item.duration) }))
    : suggestedTreatments(industry, saved);
  const people = Array.isArray(input.people) && input.people.length && input.people.every(name => typeof name === "string")
    ? (input.people as string[]).slice(0, MAX_PEOPLE).map(name => name.slice(0, MAX_PERSON_NAME)) : base.people;
  const logo = typeof input.logo === "string" ? normalizeTheme({ logo: input.logo }).logo : null;
  return {
    ...base,
    name: typeof input.name === "string" ? input.name.slice(0, 80) : base.name,
    industry,
    language: saved,
    // A day still being edited (closing before opening) is kept so the hours step asks for a fix; only a
    // malformed shape falls back to the default week.
    hours: editableHours(hours) ? hours : base.hours,
    treatments, people, logo,
    accent: (SETUP_ACCENTS_SAVED as readonly string[]).includes(input.accent as string) ? input.accent as SetupAccent : null,
  };
}

export const checkNewSlug = (value: string, demoSlug?: string) => checkOwnSlug(value, "", true, demoSlug);

/** An address from the salon's name; when the demo salon already uses it, the same with "-2". */
export function suggestedSlug(draft: SalonDraft, demoSlug?: string) {
  const slug = slugify(draft.name);
  if (checkNewSlug(slug, demoSlug).ok) return slug;
  if (checkNewSlug(slug).ok && checkNewSlug(`${slug}-2`, demoSlug).ok) return `${slug}-2`;
  const fallback = slugify(translate(draft.language, "setup.defaultName"));
  return fallback === demoSlug ? `${fallback}-2` : fallback;
}

export interface CreateOptions {
  /** Add a few example bookings after this minute of `today`, so Today is not empty. */
  examplesAfter?: number;
}

/**
 * A new browser salon. Only the core is on (Today, Calendar, Customers, Inbox, the booking
 * page and Settings): every module starts off and is added later from Features.
 */
export function createSalon(today: string, draft: SalonDraft, options: CreateOptions = {}): DemoState {
  const pack = getPack(packs[draft.industry]);
  const { language, currency, hours } = draft;
  const checked = checkNewSlug(draft.slug || suggestedSlug(draft));
  if (!checked.ok) throw new Error("Invalid salon slug");
  if (!hoursValid(hours)) throw new Error("Invalid opening hours");
  const name = draft.name.trim() || translate(language, "setup.defaultName");
  const week = weekFromHours(hours);
  const roster = (draft.people.length ? draft.people : [""]).slice(0, MAX_PEOPLE).map(person => person.slice(0, MAX_PERSON_NAME));
  const staff = roster.flatMap((person, index): Staff[] => {
    if (index && !person.trim()) return [];
    // Without a person's name the owner is shown as the salon ("With Studio Linnea"), never as its first word.
    const [firstName, ...rest] = person.trim() ? person.trim().split(/\s+/) : [name];
    return [{ id: `staff-${index + 1}`, firstName, lastName: rest.join(" "), role: "", title: "", bio: "", phone: "", week }];
  });
  const state: DemoState = {
    cancellationPolicy: DEFAULT_POLICY, checkoutHolds: [],
    version: DEMO_VERSION, industry: draft.industry, pack: pack.id, generatedFor: today, seq: 1,
    localization: { language, currency, bilingual: false },
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    salon: { name, slug: checked.slug, hours, lunch: null, closures: [], tagline: "", address: "", area: "", email: "", phone: "", orgNumber: "" },
    staff, categories: [{ id: "menu", name: translate(language, "booking.treatments") }], services: [], retiredServices: [],
    resources: [], exceptions: [], customers: [], bookings: [], journals: [], stock: [], suppliers: [], orders: [], sales: [],
    giftCards: [], packages: [], reviews: [], inbox: [], holidays: [], campaigns: [], monthHistory: [], costs: [],
    accounting: { connected: false },
    modules: Object.fromEntries(MODULE_KEYS.map(key => [key, false])) as DemoState["modules"],
    dismissedCards: [], log: [], trash: [], supportGrants: [], tickets: [], memory: [], routines: [], domain: null,
    page: { ...DEFAULT_PAGE, theme: normalizeTheme({ ...DEFAULT_THEME, logo: draft.logo ?? null, colors: draft.accent ? PALETTES[draft.accent] : null, heroPhoto: setupCover(draft.industry) }), sections: [{ kind: "hero", variant: "photo" }, { kind: "treatments", variant: "list" },
      { kind: "staff", variant: "names" }, { kind: "map", variant: "full" }] },
  };
  const thumbs = setupTreatmentPhotos(draft.industry, draft.treatments.length);
  const withMenu = draft.treatments.reduce((next, item, index) => applyServiceAction(next, { type: "service/add",
    service: { ...item, category: "menu", description: "", ...(thumbs[index] ? { image: thumbs[index] } : {}), staffIds: staff.map(person => person.id) } }), state);
  return options.examplesAfter === undefined ? withMenu : addExampleBookings(withMenu, today, options.examplesAfter);
}

const EXAMPLE_COUNT = 3;
const EXAMPLE_NAMES = ["Alva", "Nora", "Selma"];
const HALF_HOUR = 30;

/**
 * Fictional bookings for the next open days, starting an hour from now, so a new salon's day
 * is not empty. Each booking and customer carries `example`, and the surname says it too.
 */
export function addExampleBookings(state: DemoState, today: DateKey, minutes: number): DemoState {
  const services = state.services.filter(service => !service.hidden);
  const owner = state.staff[0];
  if (!services.length || !owner) return state;
  const language = state.localization.language;
  const customers: Customer[] = [];
  const bookings: Booking[] = [];
  let day = today;
  let from = Math.ceil((minutes + 60) / HALF_HOUR) * HALF_HOUR;
  for (let tries = 0; bookings.length < EXAMPLE_COUNT && tries < 14;) {
    const hours = openingFor(state.salon, day);
    const service = services[bookings.length % services.length];
    const start = Math.max(from, hours?.open ?? 0);
    if (!hours || start + service.duration > hours.close) {
      day = addDays(day, 1);
      from = 0;
      tries++;
      continue;
    }
    const number = bookings.length + 1;
    const customer: Customer = {
      id: `example-customer-${number}`, firstName: EXAMPLE_NAMES[bookings.length], lastName: translate(language, "setup.example.surname"),
      phone: "", email: "", category: service.category, preferredStaff: owner.id, since: today, isRegular: false, tags: [], waitlist: false, example: true,
    };
    customers.push(customer);
    bookings.push({ id: `example-booking-${number}`, customerId: customer.id, staffId: owner.id, serviceId: service.id, date: day, start,
      duration: service.duration, price: service.price, status: "booked", source: "online", example: true });
    from = Math.ceil((start + service.duration + 60) / HALF_HOUR) * HALF_HOUR;
  }
  return { ...state, customers: [...state.customers, ...customers], bookings: [...state.bookings, ...bookings] };
}

export const CHECKLIST_ROWS = ["addServices", "bookingPage", "share", "testBooking"] as const;
export type ChecklistRow = typeof CHECKLIST_ROWS[number];

/** The id recorded when the owner opens their booking page from the studio. */
export const pageSeenCard = (slug: string) => `page-seen:${slug}`;

/** Getting started: four core steps, each done or not. Example bookings do not count as a test booking. */
export function checklistProgress(state: DemoState): Record<ChecklistRow, boolean> {
  const slug = state.salon.slug;
  return {
    addServices: state.services.some(service => !service.hidden),
    bookingPage: state.dismissedCards.includes(pageSeenCard(slug)),
    share: state.dismissedCards.includes(`shared:${slug}`),
    testBooking: state.bookings.some(booking => !booking.example && booking.status !== "cancelled"),
  };
}
