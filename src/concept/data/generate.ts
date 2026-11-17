import {
  CUSTOMER_NOTES_FOOT,
  CUSTOMER_NOTES_MASSAGE,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  LAST_NAMES,
  SALON,
  SERVICES,
  STAFF,
  STOCK,
  SUPPLIERS,
} from "./catalog";
import { addDays, diffDays, formatTime, weekday } from "./dates";
import { makeMonthHistory } from "../finance/history";
import type { Cost } from "../finance/types";
import { upcomingHolidays } from "./holidays";
import { freeStarts, lunchFor, openingFor, staffWorks } from "./slots";
import type {
  Booking,
  BookingSource,
  Campaign,
  Category,
  Customer,
  DateKey,
  DemoState,
  InboxItem,
  JournalEntry,
  Review,
  Service,
  StaffId,
} from "./types";

export const DEMO_VERSION = 8;
const SEED = 20261116;
const HISTORY_DAYS = 182;
const FUTURE_DAYS = 35;
const DEFAULT_COSTS: Cost[] = [
  { id: "cost-rent", kind: "rent", label: "Rent", amount: 18000 },
  { id: "cost-products", kind: "products", label: "Products and supplies", amount: 12500 },
  { id: "cost-wages", kind: "wages", label: "Wages and payroll tax", amount: 110000 },
  { id: "cost-fees", kind: "fees", label: "Card fees and software", amount: 6000 },
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

interface CustomerProfile {
  customer: Customer;
  intervalDays: number;
  weight: number;
  activeFrom: DateKey;
  activeUntil?: DateKey;
  favoriteService: Record<StaffId, string>;
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

function makeCustomers(rng: Rng, today: DateKey): CustomerProfile[] {
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
    const category: Customer["category"] = roll < 0.5 ? "foot" : roll < 0.88 ? "massage" : "both";
    const preferredStaff: StaffId = category === "massage" ? "erik" : "anna";
    const isNew = !regular && rng.chance(0.18);
    const sinceDays = regular ? rng.int(200, 2200) : isNew ? rng.int(3, 120) : rng.int(160, 1500);
    const since = addDays(today, -sinceDays);
    const churned = rng.chance(regular ? 0.16 : 0.12) && sinceDays > 200;
    // Some foot care customers simply haven't rebooked yet: they show up as "due back".
    const paused = !churned && category !== "massage" && rng.chance(0.08);
    const intervalDays =
      category === "massage"
        ? regular ? rng.int(14, 32) : rng.int(28, 70)
        : regular ? rng.int(35, 52) : rng.int(42, 90);
    const notes = category === "massage" ? CUSTOMER_NOTES_MASSAGE : CUSTOMER_NOTES_FOOT;
    const note = rng.chance(regular ? 0.75 : 0.15) ? rng.pick(notes) : undefined;
    const tags: string[] = [];
    if (regular) tags.push("Regular");
    if (note?.includes("diabetes")) tags.push("Diabetes");
    if (note?.includes("Thin skin")) tags.push("Sensitive skin");
    if (note?.includes("Runner")) tags.push("Runner");
    if (sinceDays > 900 && rng.chance(0.3)) tags.push("Senior");
    const footFavorite = rng.weighted(["medical-foot-care", "basic-foot-care", "spa-foot-care", "ingrown-nail"], (s) =>
      ({ "medical-foot-care": 6, "basic-foot-care": 3, "spa-foot-care": 1.4, "ingrown-nail": 0.8 })[s] ?? 1,
    )!;
    const massageFavorite = rng.weighted(
      ["classic-60", "classic-30", "deep-tissue", "relax-90", "foot-calf-massage"],
      (s) => ({ "classic-60": 5, "classic-30": 2, "deep-tissue": 3, "relax-90": 1.3, "foot-calf-massage": 1 })[s] ?? 1,
    )!;
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
      favoriteService: { anna: footFavorite, erik: massageFavorite },
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

function servesStaff(category: Customer["category"], staffId: StaffId) {
  return category === "both" || (category === "foot" ? staffId === "anna" : staffId === "erik");
}

function makeBookings(rng: Rng, today: DateKey, profiles: CustomerProfile[]): Booking[] {
  const bookings: Booking[] = [];
  let n = 1;
  for (let offset = -HISTORY_DAYS; offset <= FUTURE_DAYS; offset++) {
    const date = addDays(today, offset);
    const hours = openingFor(SALON, date);
    if (!hours) continue;
    const lunch = lunchFor(SALON, date);
    const bookedToday = new Set<string>();
    for (const staff of STAFF) {
      if (!staffWorks(staff, SALON, date)) continue;
      const staffServices = SERVICES.filter((s) => s.staffIds.includes(staff.id));
      let cursor = hours.open;
      while (cursor < hours.close) {
        if (lunch && cursor >= lunch.start && cursor < lunch.end) {
          cursor = lunch.end;
          continue;
        }
        const windowEnd = lunch && cursor < lunch.start ? lunch.start : hours.close;
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
          if (!servesStaff(p.customer.category, staff.id)) return false;
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
        const favorite = SERVICES.find((s) => s.id === profile.favoriteService[staff.id])!;
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
  return bookings;
}

const JOURNAL_FOOT = [
  {
    treatment: "Medical foot care. Trimmed and filed nails, removed calluses on heels and balls of the feet.",
    observations: "Dry skin on the heels, small cracks on the right heel. Nails fine.",
    advice: "Urea cream 10% morning and evening. Avoid walking barefoot on cold floors.",
  },
  {
    treatment: "Treated corn on left foot (5th toe), applied felt padding.",
    observations: "Corn smaller than last visit. Pressure from a narrow shoe.",
    advice: "Switch to shoes with a wider toe box. Change the felt every third day.",
  },
  {
    treatment: "Ingrown nail, right big toe. Cleaned the nail fold and placed a packing.",
    observations: "Slight redness, no infection. The nail grows at an angle.",
    advice: "Salt foot bath twice a week. Cut straight across, not round the corners.",
  },
  {
    treatment: "Medical foot care with an extra sensation check (monofilament).",
    observations: "Normal sensation in both feet. Good circulation. Thickened nail, left big toe.",
    advice: "Keep checking the feet daily. Return visit in 6 weeks.",
  },
  {
    treatment: "Spa foot care: scrub, mask, foot care and 15 min foot massage.",
    observations: "Healthy feet, light calluses under the ball of the foot.",
    advice: "Foot cream at home twice a week is enough.",
  },
];

const JOURNAL_MASSAGE = [
  {
    treatment: "Classic massage of back, neck and shoulders. Medium pressure.",
    observations: "Very tight upper trapezius, more on the right side.",
    advice: "Neck mobility exercises twice a day. Raise the screen at work.",
  },
  {
    treatment: "Deep tissue massage of calves and thighs after running.",
    observations: "Tight calf muscles, tender around the Achilles tendon.",
    advice: "Stretch the calves after every run. Increase distance gradually.",
  },
  {
    treatment: "Relaxing full-body massage with warm oil.",
    observations: "Tension in the lower back that eased during the treatment.",
    advice: "Daily walks, heat on the lower back when needed.",
  },
];

function makeJournals(rng: Rng, profiles: CustomerProfile[], bookings: Booking[]): JournalEntry[] {
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
      const service = SERVICES.find((s) => s.id === b.serviceId)!;
      const templates = service.category === "foot" ? JOURNAL_FOOT : JOURNAL_MASSAGE;
      const t = service.id === "spa-foot-care" ? JOURNAL_FOOT[4] : service.id === "ingrown-nail" ? JOURNAL_FOOT[2] : rng.pick(templates);
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

const REVIEW_TEXT: Record<Category, Record<number, string[]>> = {
  foot: {
    5: [
      "Anna is so thorough and calm. My feet feel brand new!",
      "Best foot care I have ever had. Clean, warm and professional.",
      "Finally someone who takes my diabetic feet seriously. Thank you!",
      "Cosy salon and Anna explains everything she does. Will be back.",
      "The corn is gone after two visits. Fantastic.",
    ],
    4: [
      "Very good treatment, just a bit hard to find parking.",
      "Skilled foot therapist. Would love more evening slots.",
      "Lovely and thorough, a little pricey but worth it.",
    ],
    3: ["Good treatment but I waited 15 minutes for my appointment.", "Fine, but it felt a bit rushed this time."],
    2: ["Long wait and it felt rushed."],
  },
  massage: {
    5: [
      "Erik found exactly the right spots in my shoulders. Walked out a new person.",
      "Calm room, warm oil and perfect pressure.",
      "Best massage in Vasastan. Already booked the next one.",
      "My calves thank you for the deep tissue massage before the race!",
    ],
    4: [
      "Really nice massage. The room was a little cold at first.",
      "Good pressure and friendly welcome. Would have liked a bit more time.",
    ],
    3: ["Good massage but the pressure was too light for me.", "Okay, but the music was too loud."],
    2: ["Had hoped for more focus on my neck as I asked."],
  },
};

function makeReviews(rng: Rng, today: DateKey, bookings: Booking[]): Review[] {
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
      const service = SERVICES.find((s) => s.id === b.serviceId)!;
      const rating = rng.weighted([5, 4, 3, 2] as const, (r) => ({ 5: 0.7, 4: 0.22, 3: 0.06, 2: 0.02 })[r])!;
      const date = addDays(b.date, rng.int(0, 2));
      out.push({
        id: `r${out.length + 1}`,
        customerId: b.customerId,
        bookingId: b.id,
        staffId: b.staffId,
        date: date > today ? today : date,
        rating,
        text: rng.pick(REVIEW_TEXT[service.category][rating]),
        source: rng.chance(0.6) ? "Google" : "Booking page",
        reply: week > 1 && rng.chance(rating >= 4 ? 0.5 : 0.9)
          ? rating >= 4 ? "Thank you for the kind words! You are always welcome back. /Anna" : "Thank you for telling us – we take it to heart and hope to show our best side next time. /Anna"
          : undefined,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const ctxOf = (bookings: Booking[]) => ({ salon: SALON, staff: STAFF, bookings });

/** First free slot for a service within a date range. */
function firstFree(bookings: Booking[], staffId: StaffId, serviceId: string, from: DateKey, days: number, after = 0) {
  const service = SERVICES.find((s) => s.id === serviceId)!;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const starts = freeStarts(ctxOf(bookings), staffId, date, service.duration, { after, step: 15 });
    if (starts.length) return { staffId, serviceId, date, start: starts[0] };
  }
  return undefined;
}

function nextWeekday(today: DateKey, wd: number) {
  const diff = (wd - weekday(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

export function createDemoState(today: DateKey): DemoState {
  const rng = createRandom(SEED);
  const profiles = makeCustomers(rng, today);
  const customers = profiles.map((p) => p.customer);
  const bookings = makeBookings(rng, today, profiles);
  const name = (id: string) => {
    const c = customers.find((x) => x.id === id)!;
    return { first: c.firstName, full: `${c.firstName} ${c.lastName}` };
  };

  // Make today feel alive: one cancellation and a few gaps this afternoon.
  const inbox: InboxItem[] = [];
  let cancelled: Booking | undefined;
  if (staffWorks(STAFF[0], SALON, today)) {
    const afternoon = bookings
      .filter((b) => b.date === today && b.staffId === "anna" && b.start >= 13 * 60)
      .sort((a, b) => a.start - b.start);
    cancelled = [...afternoon].sort((a, b) => Math.abs(a.start - 15 * 60) - Math.abs(b.start - 15 * 60))[0];
    if (cancelled) {
      cancelled.status = "cancelled";
      cancelled.cancelReason = "Ill";
    }
    const drop = afternoon.find((b) => b !== cancelled && b.start >= 16 * 60);
    if (drop) bookings.splice(bookings.indexOf(drop), 1);
  }
  if (staffWorks(STAFF[1], SALON, today)) {
    const drop = bookings.find((b) => b.date === today && b.staffId === "erik" && b.start >= 14 * 60);
    if (drop) bookings.splice(bookings.indexOf(drop), 1);
  }

  const journals = makeJournals(rng, profiles, bookings);
  const reviews = makeReviews(rng, today, bookings);

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
      text: "Such a calm place. Anna took her time and explained why I get calluses. Warmly recommended!",
      source: "Google",
    });
    inbox.push({
      id: "i-omdome-5",
      kind: "review",
      customerId: happy.customerId,
      reviewId: "r-ny-1",
      date: today,
      time: 7 * 60 + 41,
      title: "New review ★★★★★",
      body: "Such a calm place. Anna took her time and explained why I get calluses. Warmly recommended!",
      read: false,
      handled: false,
      draftReply: `Thank you ${name(happy.customerId).first}, that made my day! See you next time. /Anna`,
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
      text: "Lovely massage, but I waited almost 15 minutes before we got started.",
      source: "Booking page",
    });
    inbox.push({
      id: "i-omdome-3",
      kind: "review",
      customerId: meh.customerId,
      reviewId: "r-ny-2",
      date: addDays(today, -1),
      time: 18 * 60 + 40,
      title: "New review ★★★☆☆",
      body: "Lovely massage, but I waited almost 15 minutes before we got started.",
      read: false,
      handled: false,
      draftReply: `Hi ${name(meh.customerId).first}! Sorry about the wait – that should not happen. Next time the extra 15 minutes are on us. Warm regards, Erik and Anna`,
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
      title: `Cancelled today ${formatTime(cancelled.start)}`,
      body: "Hi Anna! I woke up with a fever and have to cancel my appointment today. Sorry for the short notice.",
      read: false,
      handled: false,
      draftReply: `Get well soon ${name(cancelled.customerId).first}! Let me know when you feel better and we will find a new time. /Anna`,
    });
  }

  // Request from a regular without an upcoming booking.
  const hasFuture = new Set(bookings.filter((b) => b.date >= today && b.status === "booked").map((b) => b.customerId));
  const asker = customers.find((c) => c.isRegular && c.category === "foot" && !hasFuture.has(c.id));
  if (asker) {
    const thursday = nextWeekday(today, 4);
    const suggestion =
      firstFree(bookings, "anna", "medical-foot-care", thursday, 1, 13 * 60) ??
      firstFree(bookings, "anna", "medical-foot-care", addDays(today, 1), 10);
    inbox.push({
      id: "i-forfragan",
      kind: "request",
      customerId: asker.id,
      date: today,
      time: 7 * 60 + 12,
      title: "Asking for a time",
      body: `Hi! Do you have a foot care slot on Thursday afternoon? It is that time again. /${asker.firstName}`,
      read: false,
      handled: false,
      suggestion,
      draftReply: suggestion
        ? `Hi ${asker.firstName}! Yes, I have a slot ${suggestion.date === thursday ? "on Thursday" : "soon"} at ${formatTime(suggestion.start)}. I have booked you in – just reply if it does not suit you. /Anna`
        : undefined,
    });
  }

  // Reschedule request for an appointment in the next few days.
  const tomorrowBooking = bookings.find((b) => b.status === "booked" && diffDays(b.date, today) >= 1 && diffDays(b.date, today) <= 3);
  if (tomorrowBooking) {
    const suggestion = firstFree(bookings, tomorrowBooking.staffId, tomorrowBooking.serviceId, addDays(tomorrowBooking.date, 2), 5, 14 * 60);
    inbox.push({
      id: "i-ombokning",
      kind: "reschedule",
      customerId: tomorrowBooking.customerId,
      bookingId: tomorrowBooking.id,
      date: today,
      time: 6 * 60 + 55,
      title: "Wants to reschedule",
      body: "Hi! A meeting has come up that clashes. Could I move my appointment to later in the week, ideally after lunch?",
      read: false,
      handled: false,
      suggestion,
      draftReply: suggestion
        ? `Hi ${name(tomorrowBooking.customerId).first}! No problem. I have moved you to ${formatTime(suggestion.start)} – you will get a confirmation by text.`
        : undefined,
    });
  }

  inbox.push(
    {
      id: "i-presentkort",
      kind: "message",
      customerId: customers.find((c) => c.category === "massage" && c.isRegular)?.id,
      date: addDays(today, -1),
      time: 14 * 60 + 2,
      title: "Question about gift cards",
      body: "Hi! Do you sell gift cards? I would like to give my dad a massage for Christmas.",
      read: false,
      handled: false,
      draftReply: "Hi! Yes, we have gift cards from SEK 450. You can buy them in the salon or get a digital one by email right away. Shall I send you a link?",
    },
    {
      id: "i-nykund",
      kind: "request",
      fromName: "Tove Sjölund",
      date: addDays(today, -1),
      time: 20 * 60 + 15,
      title: "New customer wants to book",
      body: "Hi, my big toenail has been sore for a week. Could I come in soon? Tove, 070-188 21 07",
      read: true,
      handled: false,
      suggestion: firstFree(bookings, "anna", "ingrown-nail", addDays(today, 1), 7),
      draftReply: "Hi Tove! That sounds like an ingrown nail – I can help with that. I have a slot for you, see below. /Anna",
    },
    {
      id: "i-paminnelser",
      kind: "system",
      date: today,
      time: 7 * 60,
      title: "Reminders sent",
      body: `${bookings.filter((b) => b.date === addDays(today, 1) && b.status === "booked").length} customers got a text reminder about tomorrow. (Simulated – the demo never sends real texts.)`,
      read: true,
      handled: true,
    },
  );
  inbox.sort((a, b) => (b.date + formatTime(b.time)).localeCompare(a.date + formatTime(a.time)));

  const campaigns: Campaign[] = [
    {
      id: "c-autumn",
      name: "Autumn massage −15%",
      serviceIds: ["classic-60", "deep-tissue"],
      discountPercent: 15,
      from: addDays(today, -78),
      to: addDays(today, -36),
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      publishOn: addDays(today, -78),
      link: "salongeko.example/c/autumn-massage-4f8",
      stats: { reach: 2840, clicks: 212, bookings: 23, revenue: 23 * 782 },
    },
    {
      id: "c-bundle",
      name: "Foot care + calf massage bundle",
      serviceIds: ["medical-foot-care", "foot-calf-massage"],
      discountPercent: 10,
      from: addDays(today, -9),
      to: addDays(today, 19),
      status: "active",
      channels: ["instagram", "facebook"],
      publishOn: addDays(today, -9),
      link: "salongeko.example/c/foot-bundle-2k9",
      stats: { reach: 1310, clicks: 96, bookings: 7, revenue: 7 * 840 },
    },
  ];

  return {
    version: DEMO_VERSION,
    generatedFor: today,
    seq: 1,
    salon: SALON,
    staff: STAFF,
    services: SERVICES,
    customers,
    bookings,
    journals,
    stock: STOCK.map((s) => ({ ...s })),
    suppliers: SUPPLIERS,
    orders: [],
    sales: [],
    reviews,
    inbox,
    holidays: upcomingHolidays(today),
    campaigns,
    monthHistory: makeMonthHistory(bookings, today, HISTORY_DAYS, createRandom(SEED + 7).next),
    costs: DEFAULT_COSTS.map((c) => ({ ...c })),
    accounting: { connected: false },
    modules: { journal: true, stock: true, campaigns: true, finance: true, reviews: true },
    dismissedCards: [],
  };
}
