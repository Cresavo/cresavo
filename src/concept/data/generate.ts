import { DEFAULT_POLICY } from "../booking/protection";
import { translate } from "../i18n";
import { DEFAULT_REMINDER_SETTINGS } from "../booking/reminders";
import { formatDayLong, formatMoney } from "../i18n/format";
import { defaultBusinessLocalization, type BusinessLocalization } from "../i18n/business";
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from "./catalog";
import { addDays, diffDays, formatTime, weekday } from "./dates";
import { makeMonthHistory } from "../finance/history";
import { DEFAULT_PAGE } from "../page/config";
import { PALETTES } from "../page/theme";
import { DEFAULT_PACK, getPack } from "../packs";
import { ROOMS } from "../packs/base";
import { startCategories } from "../services/categories";
import type { Pack } from "../packs/types";
import type { Cost } from "../finance/types";
import { upcomingHolidays } from "./holidays";
import { lunchFor, openingFor, pickResource, freeStarts, needOf, staffWorks, workWindow } from "./slots";
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
  PackId,
  Resource,
  Review,
  Service,
  Staff,
  StaffId,
} from "./types";

export const DEMO_VERSION = 23;
const SEED = 20261116;
const HISTORY_DAYS = 182;
const FUTURE_DAYS = 35;
const DEFAULT_COSTS: Cost[] = [
  { id: "cost-rent", kind: "rent", label: translate("en", "fixture.cost.cost-rent"), amount: 18000 },
  { id: "cost-products", kind: "products", label: translate("en", "fixture.cost.cost-products"), amount: 12500 },
  { id: "cost-wages", kind: "wages", label: translate("en", "fixture.cost.cost-wages"), amount: 110000 },
  { id: "cost-fees", kind: "fees", label: translate("en", "fixture.cost.cost-fees"), amount: 6000 },
];
const CUSTOMER_COUNT = 360;
const REGULAR_COUNT = 40;

/** Small seeded random generator (mulberry32) so the demo looks the same every time. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
  const chance = (p: number) => next() < p;
  const weighted = <T,>(items: readonly T[], weight: (item: T) => number): T | undefined => {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    if (total <= 0) return undefined;
    let r = next() * total;
    for (const item of items) {
      r -= weight(item);
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  };
  return { next, int, pick, chance, weighted };
}

type Rng = ReturnType<typeof createRandom>;

/** What the generator draws on: the industry pack and how many people work in the business. */
interface Build {
  pack: Pack;
  staff: Staff[];
  services: Service[];
  resources: Resource[];
  solo: boolean;
}

interface CustomerProfile {
  customer: Customer;
  intervalDays: number;
  weight: number;
  activeFrom: DateKey;
  activeUntil?: DateKey;
  favoriteService: Record<string, string>;
  lastVisit?: DateKey;
}

const ascii = (s: string) =>
  s.toLowerCase().replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/é/g, "e");

/** Fictional birthday spread over the year; about seven in ten customers have one on file. */
function birthdayFor(index: number): DateKey | undefined {
  if (index % 10 >= 7) return undefined;
  const year = 1948 + ((index * 13) % 52);
  const month = ((index * 5 + 3) % 12) + 1;
  const day = ((index * 11) % 28) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function makeCustomers(rng: Rng, today: DateKey, { pack, solo }: Build): CustomerProfile[] {
  const [first, second] = pack.categories;
  const used = new Set<string>();
  const phones = new Set<string>();
  const profiles: CustomerProfile[] = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const regular = i < REGULAR_COUNT;
    const female = rng.chance(0.68);
    let firstName = "";
    let lastName = "";
    do {
      firstName = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
      lastName = rng.pick(LAST_NAMES);
    } while (used.has(`${firstName} ${lastName}`));
    used.add(`${firstName} ${lastName}`);
    let phone = "";
    do {
      phone = `070-1${rng.int(10, 99)} ${rng.int(10, 99)} ${rng.int(10, 99)}`;
    } while (phones.has(phone));
    phones.add(phone);

    const roll = rng.next();
    const category: Customer["category"] = roll < 0.5 ? first : roll < 0.88 ? second : "both";
    const preferredStaff: StaffId = category === second && !solo ? "erik" : "anna";
    const isNew = !regular && rng.chance(0.18);
    const sinceDays = regular ? rng.int(200, 2200) : isNew ? rng.int(3, 120) : rng.int(160, 1500);
    const since = addDays(today, -sinceDays);
    const churned = rng.chance(regular ? 0.16 : 0.12) && sinceDays > 200;
    // Some foot care customers simply haven't rebooked yet: they show up as "due back".
    const paused = !churned && category !== second && rng.chance(0.08);
    const intervalDays =
      category === second
        ? regular ? rng.int(14, 32) : rng.int(28, 70)
        : regular ? rng.int(35, 52) : rng.int(42, 90);
    const notes = pack.customerNotes[category === second ? 1 : 0];
    const note = rng.chance(regular ? 0.75 : 0.15) ? rng.pick(notes) : undefined;
    const tags: string[] = [];
    if (regular) tags.push("Regular");
    for (const rule of pack.tagRules) if (note?.includes(rule.find)) tags.push(rule.tag);
    if (sinceDays > 900 && rng.chance(0.3)) tags.push("Senior");
    const favorite = (index: 0 | 1) => rng.weighted(Object.keys(pack.popular[index]), (id) => pack.popular[index][id] ?? 1)!;
    const firstFavorite = favorite(0);
    const secondFavorite = favorite(1);
    profiles.push({
      customer: {
        id: `k${String(i + 1).padStart(3, "0")}`,
        firstName,
        lastName,
        phone,
        email: `${ascii(firstName)}.${ascii(lastName)}@mail.example`,
        category,
        preferredStaff,
        since,
        birthday: birthdayFor(i),
        isRegular: regular,
        note,
        tags,
        waitlist: rng.chance(regular ? 0.35 : 0.12),
      },
      intervalDays,
      weight: regular ? 3.2 : 1,
      activeFrom: since,
      activeUntil: churned ? addDays(today, -rng.int(75, 150)) : paused ? addDays(today, -rng.int(52, 62)) : undefined,
      favoriteService: { [first]: firstFavorite, [second]: secondFavorite },
    });
  }
  return profiles;
}

function occupancy(offset: number): number {
  if (offset < 0) return 0.86;
  if (offset === 0) return 0.92;
  if (offset <= 7) return 0.9;
  if (offset <= 14) return 0.78;
  if (offset <= 21) return 0.64;
  return 0.16;
}

/** Anna takes the first category and Erik the second; a one-person business takes everything. */
function servesStaff(category: Customer["category"], staffId: StaffId, { pack, solo }: Build) {
  return solo || category === "both" || (category === pack.categories[0] ? staffId === "anna" : staffId === "erik");
}

function makeBookings(rng: Rng, today: DateKey, profiles: CustomerProfile[], build: Build): Booking[] {
  const { pack, staff: team, services, solo } = build;
  const salon = pack.salon;
  const schedule = ctxOf(build, []);
  const bookings: Booking[] = [];
  let n = 1;
  for (let offset = -HISTORY_DAYS; offset <= FUTURE_DAYS; offset++) {
    const date = addDays(today, offset);
    const hours = openingFor(salon, date);
    if (!hours) continue;
    const lunch = lunchFor(salon, date);
    const bookedToday = new Set<string>();
    for (const staff of team) {
      const window = workWindow(schedule, staff.id, date);
      if (!window) continue;
      const staffServices = services.filter((s) => s.staffIds.includes(staff.id));
      let cursor = window.start;
      while (cursor < window.end) {
        if (lunch && cursor >= lunch.start && cursor < lunch.end) {
          cursor = lunch.end;
          continue;
        }
        const windowEnd = lunch && cursor < lunch.start ? lunch.start : window.end;
        const room = windowEnd - cursor;
        if (room < 30) {
          cursor = windowEnd;
          continue;
        }
        if (!rng.chance(occupancy(offset))) {
          cursor += Math.min(room, rng.pick([30, 45, 60, 60]));
          continue;
        }
        const eligible = profiles.filter((p) => {
          if (!servesStaff(p.customer.category, staff.id, build)) return false;
          if (date < p.activeFrom || (p.activeUntil && date > p.activeUntil)) return false;
          if (bookedToday.has(p.customer.id)) return false;
          return !p.lastVisit || diffDays(date, p.lastVisit) >= p.intervalDays * 0.6;
        });
        const profile = rng.weighted(eligible, (p) => {
          const since = p.lastVisit ? diffDays(date, p.lastVisit) : p.intervalDays * 1.5;
          return p.weight * Math.min(3, since / p.intervalDays);
        });
        if (!profile) {
          cursor += Math.min(room, 60);
          continue;
        }
        const ownCategory = solo ? (profile.customer.category === "both" ? pack.categories[0] : profile.customer.category) : pack.categories[staff.id === "anna" ? 0 : 1];
        const favorite = services.find((s) => s.id === profile.favoriteService[ownCategory])!;
        let service: Service | undefined = rng.chance(0.78) ? favorite : rng.pick(staffServices);
        if (service.duration > room) {
          service = staffServices.filter((s) => s.duration <= room).sort((a, b) => b.duration - a.duration)[0];
        }
        if (!service) {
          cursor = windowEnd;
          continue;
        }
        let status: Booking["status"] = "booked";
        if (offset < 0) {
          const r = rng.next();
          status = r < 0.035 ? "cancelled" : r < 0.05 ? "noshow" : "completed";
        }
        const source: BookingSource = rng.weighted(
          ["online", "phone", "walk-in"] as const,
          (s) => ({ online: 0.56, phone: 0.29, "walk-in": 0.15 })[s],
        )!;
        bookings.push({
          id: `b${n++}`,
          customerId: profile.customer.id,
          staffId: staff.id,
          serviceId: service.id,
          date,
          start: cursor,
          duration: service.duration,
          price: service.price,
          status,
          source,
        });
        if (status !== "cancelled") profile.lastVisit = date;
        bookedToday.add(profile.customer.id);
        cursor += service.duration + (rng.chance(0.12) ? 15 : 0);
      }
    }
  }
  return assignResources(build, bookings);
}

/**
 * Today's last half hour is never empty in the demo: a person whose visits end early gets one more, placed by the
 * same free-time rules as any booking, so there is someone still to come all through the working day.
 */
function keepEveningBooked(build: Build, today: DateKey, profiles: CustomerProfile[], bookings: Booking[]) {
  for (const staff of build.staff) {
    const window = workWindow(ctxOf(build, []), staff.id, today);
    if (!window) continue;
    const day = () => bookings.filter((b) => b.date === today && b.status !== "cancelled");
    if (day().some((b) => b.staffId === staff.id && b.start + b.duration >= window.end - 30)) continue;
    const service = build.services.filter((s) => s.staffIds.includes(staff.id) && s.duration <= 60).sort((a, b) => b.duration - a.duration)[0];
    if (!service) continue;
    const start = freeStarts(ctxOf(build, day()), staff.id, today, needOf(service), { after: window.end - 90, step: 15 }).at(-1);
    const taken = new Set(day().map((b) => b.customerId));
    const profile = profiles.find((p) => servesStaff(p.customer.category, staff.id, build) && !taken.has(p.customer.id)
      && p.activeFrom <= today && (!p.activeUntil || today <= p.activeUntil));
    if (start === undefined || !profile) continue;
    bookings.push({
      id: `b-evening-${staff.id}`,
      customerId: profile.customer.id,
      staffId: staff.id,
      serviceId: service.id,
      date: today,
      start,
      duration: service.duration,
      price: service.price,
      status: "booked",
      source: "online",
      resourceId: pickResource(ctxOf(build, day()), needOf(service), today, start),
    });
  }
}

/** Gives every visit the first free room, so the generated week never double-books one. */
function assignResources(build: Build, bookings: Booking[]): Booking[] {
  const placed: Booking[] = [];
  const ordered = [...bookings].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  let day = "";
  for (const booking of ordered) {
    if (booking.date !== day) {
      day = booking.date;
      placed.length = 0;
    }
    if (booking.status === "cancelled") continue;
    booking.resourceId = pickResource(ctxOf(build, placed), { serviceId: booking.serviceId, duration: booking.duration }, booking.date, booking.start);
    placed.push(booking);
  }
  return bookings;
}

function makeJournals(rng: Rng, profiles: CustomerProfile[], bookings: Booking[], { pack, services }: Build): JournalEntry[] {
  const out: JournalEntry[] = [];
  const byCustomer = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.status !== "completed") continue;
    const list = byCustomer.get(b.customerId) ?? [];
    list.push(b);
    byCustomer.set(b.customerId, list);
  }
  for (const p of profiles) {
    if (!p.customer.isRegular && !rng.chance(0.2)) continue;
    const done = (byCustomer.get(p.customer.id) ?? []).slice(-3);
    for (const b of done) {
      const service = services.find((s) => s.id === b.serviceId)!;
      const templates = pack.journal[service.category === pack.categories[0] ? 0 : 1];
      const t = pack.journalFor[service.id] ?? rng.pick(templates);
      out.push({
        id: `j${out.length + 1}`,
        customerId: b.customerId,
        bookingId: b.id,
        date: b.date,
        staffId: b.staffId,
        ...t,
        nextVisit: `In ${service.recallWeeks} weeks`,
      });
    }
  }
  return out;
}

function makeReviews(rng: Rng, today: DateKey, bookings: Booking[], { pack, services }: Build): Review[] {
  const out: Review[] = [];
  const completed = bookings.filter((b) => b.status === "completed");
  for (let week = 0; week < 26; week++) {
    const from = addDays(today, -7 * (week + 1));
    const to = addDays(today, -7 * week - 1);
    const pool = completed.filter((b) => b.date >= from && b.date <= to);
    const used = new Set<string>();
    for (let i = 0; i < 3 && pool.length; i++) {
      const b = rng.pick(pool);
      if (used.has(b.customerId)) continue;
      used.add(b.customerId);
      const service = services.find((s) => s.id === b.serviceId)!;
      const rating = rng.weighted([5, 4, 3, 2] as const, (r) => ({ 5: 0.7, 4: 0.22, 3: 0.06, 2: 0.02 })[r])!;
      const date = addDays(b.date, rng.int(0, 2));
      out.push({
        id: `r${out.length + 1}`,
        customerId: b.customerId,
        bookingId: b.id,
        staffId: b.staffId,
        date: date > today ? today : date,
        rating,
        text: rng.pick(pack.reviews[service.category === pack.categories[0] ? 0 : 1][rating]),
        source: rng.chance(0.6) ? "Google" : "Booking page",
        reply: week > 1 && rng.chance(rating >= 4 ? 0.5 : 0.9)
          ? rating >= 4 ? translate("en", "fixture.review.reply.happy") : translate("en", "fixture.review.reply.unhappy")
          : undefined,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const ctxOf = (build: Build, bookings: Booking[]) => ({ salon: build.pack.salon, staff: build.staff, services: build.services, resources: build.resources, exceptions: [], bookings });

/** First free slot for a service within a date range. */
function firstFree(build: Build, bookings: Booking[], staffId: StaffId, serviceId: string, from: DateKey, days: number, after = 0) {
  const service = build.services.find((s) => s.id === serviceId)!;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const starts = freeStarts(ctxOf(build, bookings), staffId, date, needOf(service), { after, step: 15 });
    if (starts.length) return { staffId, serviceId, date, start: starts[0] };
  }
  return undefined;
}

function nextWeekday(today: DateKey, wd: number) {
  const diff = (wd - weekday(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

/** Which business the demo shows: an industry pack, a one-person or a two-person team, and the modules switched on. */
export interface BusinessSetup {
  pack?: PackId;
  solo?: boolean;
  modules?: ModuleKey[];
  localization?: BusinessLocalization;
}

export const MODULE_KEYS: ModuleKey[] = ["journal", "stock", "campaigns", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages", "domain"];

/** A solo business has only the owner, who takes over all services. */
function buildFor(pack: Pack, solo: boolean): Build {
  return {
    pack,
    solo,
    staff: solo ? [pack.staff[0]] : pack.staff,
    services: pack.services.map((s) => ({ ...s, resourceIds: ROOMS.map((r) => r.id), ...(solo ? { staffIds: ["anna" as StaffId] } : {}) })),
    resources: ROOMS,
  };
}

/** The demo's shortest working day: nine to six. */
const FULL_DAY = { open: 9 * 60, close: 18 * 60 };

/**
 * The demo always shows a full, lively day. Whatever weekday it is generated for, the fixture salon is open at
 * least nine to six that weekday and the whole team works it, so Today is never closed on a weekend. Only the
 * fixture changes: the booking rules are the same, and a salon of one's own keeps its own hours.
 */
export function openOnDemoDay(pack: Pack, today: DateKey): Pack {
  const day = weekday(today);
  const usual = pack.salon.hours[day];
  const open = Math.min(usual?.open ?? FULL_DAY.open, FULL_DAY.open);
  const close = Math.max(usual?.close ?? FULL_DAY.close, FULL_DAY.close);
  return {
    ...pack,
    salon: { ...pack.salon, hours: { ...pack.salon.hours, [day]: { open, close } }, closures: pack.salon.closures.filter((c) => c.date !== today) },
    staff: [working(pack.staff[0]), working(pack.staff[1])],
  };
  function working(person: Staff): Staff {
    return { ...person, week: { ...person.week, [day]: { start: open, end: close } } };
  }
}

export function createDemoState(today: DateKey, setup: BusinessSetup = {}): DemoState {
  const pack = openOnDemoDay(getPack(setup.pack ?? DEFAULT_PACK), today);
  const build = buildFor(pack, setup.solo ?? false);
  const { staff: team, services } = build;
  const localization = setup.localization ?? defaultBusinessLocalization(pack.id);
  const { language, currency } = localization;
  const salon = pack.salon;
  const schedule = ctxOf(build, []);
  const rng = createRandom(SEED);
  const profiles = makeCustomers(rng, today, build);
  const customers = profiles.map((p) => p.customer);
  const bookings = makeBookings(rng, today, profiles, build);
  keepEveningBooked(build, today, profiles, bookings);
  const name = (id: string) => {
    const c = customers.find((x) => x.id === id)!;
    return { first: c.firstName, full: `${c.firstName} ${c.lastName}` };
  };

  // Make today feel alive: one cancellation and a few gaps this afternoon. Each person's last visit stays, so
  // there is still someone to come until the end of the day.
  const inbox: InboxItem[] = [];
  let cancelled: Booking | undefined;
  const lastOfDay = (staffId: StaffId) => bookings.filter((b) => b.date === today && b.staffId === staffId).reduce<Booking | undefined>((last, b) => (!last || b.start > last.start ? b : last), undefined);
  if (staffWorks(schedule, team[0].id, today)) {
    const afternoon = bookings
      .filter((b) => b.date === today && b.staffId === "anna" && b.start >= 13 * 60)
      .sort((a, b) => a.start - b.start);
    cancelled = [...afternoon].sort((a, b) => Math.abs(a.start - 15 * 60) - Math.abs(b.start - 15 * 60))[0];
    if (cancelled) {
      cancelled.status = "cancelled";
      cancelled.cancelReason = "Ill";
    }
    const drop = afternoon.find((b) => b !== cancelled && b !== lastOfDay("anna") && b.start >= 16 * 60);
    if (drop) bookings.splice(bookings.indexOf(drop), 1);
  }
  if (team[1] && staffWorks(schedule, team[1].id, today)) {
    const drop = bookings.find((b) => b.date === today && b.staffId === "erik" && b !== lastOfDay("erik") && b.start >= 14 * 60);
    if (drop) bookings.splice(bookings.indexOf(drop), 1);
  }

  const journals = makeJournals(rng, profiles, bookings, build);
  const reviews = makeReviews(rng, today, bookings, build);

  // Two fresh reviews that show up in the inbox.
  const recentDone = bookings.filter((b) => b.status === "completed" && diffDays(today, b.date) <= 3 && diffDays(today, b.date) >= 1);
  const happy = recentDone.find((b) => b.staffId === "anna") ?? recentDone[0];
  const meh = recentDone.find((b) => b.staffId === "erik" && b.customerId !== happy?.customerId) ?? recentDone[1];
  if (happy) {
    reviews.unshift({
      id: "r-ny-1",
      customerId: happy.customerId,
      bookingId: happy.id,
      staffId: happy.staffId,
      date: today,
      rating: 5,
      text: pack.freshReviews.happy,
      source: "Google",
    });
    inbox.push({
      id: "i-omdome-5",
      kind: "review",
      customerId: happy.customerId,
      reviewId: "r-ny-1",
      date: today,
      time: 7 * 60 + 41,
      title: translate("en", "fixture.inbox.reviewTitle", { stars: "★★★★★" }),
      body: pack.freshReviews.happy,
      read: false,
      handled: false,
      draftReply: translate(language, "reviews.draftHappy", { name: name(happy.customerId).first }, pack.vocabulary),
    });
  }
  if (meh) {
    reviews.unshift({
      id: "r-ny-2",
      customerId: meh.customerId,
      bookingId: meh.id,
      staffId: meh.staffId,
      date: addDays(today, -1),
      rating: 3,
      text: pack.freshReviews.meh,
      source: "Booking page",
    });
    inbox.push({
      id: "i-omdome-3",
      kind: "review",
      customerId: meh.customerId,
      reviewId: "r-ny-2",
      date: addDays(today, -1),
      time: 18 * 60 + 40,
      title: translate("en", "fixture.inbox.reviewTitle", { stars: "★★★☆☆" }),
      body: pack.freshReviews.meh,
      read: false,
      handled: false,
      draftReply: translate(language, "reviews.draftUnhappy", { name: name(meh.customerId).first }, pack.vocabulary),
    });
  }

  if (cancelled) {
    inbox.push({
      id: "i-avbokning",
      kind: "cancel",
      customerId: cancelled.customerId,
      bookingId: cancelled.id,
      date: today,
      time: 7 * 60 + 48,
      title: translate("en", "fixture.inbox.cancelTitle", { time: formatTime(cancelled.start) }),
      body: translate("en", "fixture.inbox.cancelBody"),
      read: false,
      handled: false,
      draftReply: translate(language, "fixture.reply.cancel", { name: name(cancelled.customerId).first }, pack.vocabulary),
    });
  }

  // Request from a regular without an upcoming booking.
  const hasFuture = new Set(bookings.filter((b) => b.date >= today && b.status === "booked").map((b) => b.customerId));
  const asker = customers.find((c) => c.isRegular && c.category === pack.categories[0] && !hasFuture.has(c.id));
  if (asker) {
    const thursday = nextWeekday(today, 4);
    const suggestion =
      firstFree(build, bookings, "anna", pack.requests.returning.serviceId, thursday, 1, 13 * 60) ??
      firstFree(build, bookings, "anna", pack.requests.returning.serviceId, addDays(today, 1), 10);
    inbox.push({
      id: "i-forfragan",
      kind: "request",
      customerId: asker.id,
      date: today,
      time: 7 * 60 + 12,
      title: translate("en", "fixture.inbox.requestTitle"),
      body: `${pack.requests.returning.body} /${asker.firstName}`,
      read: false,
      handled: false,
      suggestion,
      draftReply: suggestion
        ? translate(language, "fixture.reply.booking", { name: asker.firstName, day: formatDayLong(suggestion.date, language), time: formatTime(suggestion.start) }, pack.vocabulary)
        : undefined,
    });
  }

  // Reschedule request for an appointment in the next few days.
  const tomorrowBooking = bookings.find((b) => b.status === "booked" && diffDays(b.date, today) >= 1 && diffDays(b.date, today) <= 3);
  if (tomorrowBooking) {
    const suggestion = firstFree(build, bookings, tomorrowBooking.staffId, tomorrowBooking.serviceId, addDays(tomorrowBooking.date, 2), 5, 14 * 60);
    inbox.push({
      id: "i-ombokning",
      kind: "reschedule",
      customerId: tomorrowBooking.customerId,
      bookingId: tomorrowBooking.id,
      date: today,
      time: 6 * 60 + 55,
      title: translate("en", "fixture.inbox.moveTitle"),
      body: translate("en", "fixture.inbox.moveBody"),
      read: false,
      handled: false,
      suggestion,
      draftReply: suggestion
        ? translate(language, "fixture.reply.move", { name: name(tomorrowBooking.customerId).first, day: formatDayLong(suggestion.date, language), time: formatTime(suggestion.start) }, pack.vocabulary)
        : undefined,
    });
  }

  inbox.push(
    {
      id: "i-presentkort",
      kind: "message",
      customerId: customers.find((c) => c.category === pack.categories[1] && c.isRegular)?.id,
      date: addDays(today, -1),
      time: 14 * 60 + 2,
      title: translate("en", "fixture.inbox.giftTitle"),
      body: `Hi! Do you sell gift cards? I would like to give my dad ${pack.giftIdea} for Christmas.`,
      read: false,
      handled: false,
      draftReply: translate(language, "fixture.reply.gift", { price: formatMoney(450, currency, language) }, pack.vocabulary),
    },
    {
      id: "i-nykund",
      kind: "request",
      fromName: pack.requests.newClient.name,
      date: addDays(today, -1),
      time: 20 * 60 + 15,
      title: translate("en", "fixture.inbox.newTitle"),
      body: pack.requests.newClient.body,
      read: true,
      handled: false,
      suggestion: firstFree(build, bookings, "anna", pack.requests.newClient.serviceId, addDays(today, 1), 7),
      draftReply: language === "en" ? pack.requests.newClient.reply
        : translate(language, "fixture.reply.newCustomer", { name: pack.requests.newClient.name.split(" ")[0] }, pack.vocabulary),
    },
    {
      id: "i-paminnelser",
      kind: "system",
      date: today,
      time: 7 * 60,
      title: translate("en", "fixture.inbox.remindersTitle"),
      body: translate("en", "fixture.inbox.remindersBody", { count: bookings.filter((b) => b.date === addDays(today, 1) && b.status === "booked").length }),
      read: true,
      handled: true,
    },
  );
  inbox.sort((a, b) => (b.date + formatTime(b.time)).localeCompare(a.date + formatTime(a.time)));

  const campaigns: Campaign[] = pack.campaigns.map(({ startsInDays, endsInDays, ...campaign }) => ({
    ...campaign,
    from: addDays(today, startsInDays),
    to: addDays(today, endsInDays),
    publishOn: addDays(today, startsInDays),
  }));

  return {
    cancellationPolicy: DEFAULT_POLICY, checkoutHolds: [],
    version: DEMO_VERSION,
    industry: null,
    pack: pack.id,
    generatedFor: today,
    seq: 1,
    salon,
    localization,
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    staff: team,
    services,
    retiredServices: [],
    categories: startCategories(pack),
    resources: build.resources,
    exceptions: [],
    customers,
    bookings,
    journals,
    stock: pack.stock.map((s) => ({ ...s })),
    suppliers: pack.suppliers,
    orders: [],
    sales: [],
    giftCards: [],
    packages: [],
    reviews,
    inbox,
    holidays: upcomingHolidays(today, pack.featured),
    campaigns,
    monthHistory: makeMonthHistory(bookings, today, HISTORY_DAYS, createRandom(SEED + 7).next),
    costs: DEFAULT_COSTS.map((c) => ({ ...c })),
    accounting: { connected: false },
    modules: Object.fromEntries(MODULE_KEYS.map((key) => [key, (setup.modules ?? pack.modules).includes(key)])) as Record<ModuleKey, boolean>,
    dismissedCards: [],
    log: [],
    trash: cancelled ? [{ id: "t-cancelled-today", kind: "booking", deletedOn: today, bookingId: cancelled.id }] : [],
    supportGrants: [],
    tickets: [],
    memory: [],
    routines: [],
    page: pack.palette ? { ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, colors: PALETTES[pack.palette] } } : DEFAULT_PAGE,
    domain: null,
  };
}
