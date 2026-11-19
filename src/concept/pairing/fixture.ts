import type { PairWorkspace } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createDemoState } from "../data/generate";
import { weekday } from "../data/dates";
import type { DemoState } from "../data/types";
import { hair } from "../packs/hair";
import { t } from "../i18n";
import { digest, requirePair } from "./http";

export type PairState = DemoState & { bookingVersions?: Record<string, number> };

function project(state: DemoState): PairState {
  const bookings = state.bookings.filter(b => b.status === "booked" && b.date >= state.generatedFor)
    .map(({ id, customerId, staffId, serviceId, date, start, duration, price, status, source, resourceId }) =>
      ({ id, customerId, staffId, serviceId, date, start, duration, price, status, source, resourceId }));
  const needed = new Set(bookings.map(b => b.customerId));
  const customers = state.customers.filter(c => needed.has(c.id)).map(({ id, firstName, lastName, preferredStaff }) => ({
    id, firstName, lastName, preferredStaff, phone: "", email: "", since: state.generatedFor,
    category: "both", tags: [], isRegular: false, waitlist: false,
  }));
  return {
    version: state.version, generatedFor: state.generatedFor, seq: state.seq, pack: state.pack, salon: state.salon,
    staff: state.staff, services: state.services, resources: state.resources, categories: state.categories,
    modules: state.modules, page: state.page, bookings, customers, inbox: [],
    exceptions: [], retiredServices: [], journals: [], reviews: [], log: [], trash: [], memory: [], routines: [],
    stock: [], suppliers: [], orders: [], sales: [], giftCards: [], packages: [], holidays: [], campaigns: [],
    monthHistory: [], costs: [], accounting: { connected: false }, dismissedCards: [], supportGrants: [], tickets: [], domain: null,
  };
}

function neutralInbox(state: DemoState, bookingId: string, ids: string[]) {
  const booking = state.bookings.find(b => b.id === bookingId);
  requirePair(booking, "fixture_unavailable", 503);
  state.inbox = [{
    id: ids[0], kind: "reschedule", date: state.generatedFor, time: 540, bookingId,
    customerId: booking.customerId, title: t("pair.request"), body: t("pair.request"), read: false, handled: false,
  }, {
    id: ids[1], kind: "message", date: state.generatedFor, time: 530, title: t("pair.sampleTitle"),
    body: t("pair.sampleBody"), read: false, handled: false,
  }];
}

// Cache one private daily template. Each visitor gets independent records and fresh public IDs.
let template: PairState | undefined;
export function freshSnapshot(today: string) {
  if (!template || template.generatedFor !== today) template = project(createDemoState(today, { pack: "hair" }));
  const fresh = structuredClone(template);
  for (const booking of fresh.bookings) booking.id = randomUUID();
  const friday = fresh.bookings.find(b => b.date > today && weekday(b.date) === 5);
  requirePair(friday, "fixture_unavailable", 503);
  neutralInbox(fresh, friday.id, [randomUUID(), randomUUID()]);
  return fresh;
}

export function snapshot(w: PairWorkspace): PairState {
  const state = w.snapshot as unknown as PairState;
  if (w.version === 2) return state;
  requirePair(w.version === 1, "unsupported_snapshot", 409);
  const safe = project(state);
  // V1 used clinical service labels. Preserve scheduling needs and booking IDs
  // while removing the old treatment information, including from service IDs.
  const serviceIds = new Map(safe.services.map(service => [service.id, legacyServiceId(service.name)]));
  safe.services = safe.services.map(service => ({
    id: serviceIds.get(service.id)!, name: t("pair.legacyService"), description: "", category: "cut",
    duration: service.duration, price: service.price, staffIds: service.staffIds, resourceIds: service.resourceIds,
    recallWeeks: service.recallWeeks,
  }));
  for (const booking of safe.bookings) booking.serviceId = serviceIds.get(booking.serviceId)!;
  safe.pack = hair.id;
  safe.salon = hair.salon;
  safe.staff = hair.staff;
  safe.categories = [];
  neutralInbox(safe, state.inbox[0].bookingId!, state.inbox.slice(0, 2).map(i => i.id));
  return safe;
}

export const legacyServiceId = (name: string) => "legacy-" + digest(name);
