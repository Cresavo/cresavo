import type { PairWorkspace } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { initialWaitlist } from "../booking/waitlist-types";
import { createDemoState } from "../data/generate";
import { weekday } from "../data/dates";
import type { DemoState, Interval, StaffId } from "../data/types";
import { hair } from "../packs/hair";
import { t } from "../i18n";
import { defaultBusinessLocalization } from "../i18n/business";
import { digest, requirePair } from "./http";

export interface PairState extends DemoState {
  bookingVersions?: Record<string, number>;
  entityVersions?: Record<string, number>;
  scheduleChanges?: Record<string, Interval[]>;
  staffRefs?: Record<StaffId, string>;
}

function project(state: DemoState, includeHistory = false): PairState {
  const bookings = state.bookings.filter(b => (b.status === "booked" && b.date >= state.generatedFor) ||
    (includeHistory && b.date <= state.generatedFor))
    .map(({ id, customerId, staffId, serviceId, date, start, duration, price, status, source, resourceId }) =>
      ({ id, customerId, staffId, serviceId, date, start, duration, price, status, source, resourceId }));
  const needed = new Set(bookings.map(b => b.customerId));
  const customers = state.customers.filter(c => needed.has(c.id)).map(({ id, firstName, lastName, preferredStaff, since }) => ({
    id, firstName, lastName, preferredStaff, phone: "", email: "", since,
    category: "both", tags: [], isRegular: false, waitlist: false,
  }));
  return {
    version: state.version, generatedFor: state.generatedFor, seq: state.seq, pack: state.pack, salon: state.salon,
    industry: state.industry ?? null,
    localization: state.localization ?? defaultBusinessLocalization(state.pack),
    staff: state.staff, services: state.services, resources: state.resources, categories: state.categories,
    modules: state.modules, page: state.page, bookings, customers, inbox: [],
    exceptions: [], retiredServices: [], journals: [], reviews: [], log: [], trash: [], memory: [], routines: [],
    stock: [], suppliers: [], orders: [], sales: [], giftCards: [], packages: [], holidays: [], campaigns: [],
    monthHistory: includeHistory ? state.monthHistory : [], costs: [], accounting: { connected: false }, dismissedCards: [], supportGrants: [], tickets: [], domain: null,
    reminderSettings: state.reminderSettings,
    cancellationPolicy: state.cancellationPolicy, checkoutHolds: [],
    ...initialWaitlist(), waitlistRules: state.waitlistRules,
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

// The old snapshots already had workspace-specific booking and Inbox IDs. Give
// newly exposed entities stable references as well, including before the first write.
export const scopedRef = (namespace: string, kind: "staff" | "customer" | "service", id: string) =>
  digest(`${namespace}:${kind}:${id}`);

function scopeEntities(state: PairState, namespace: string): PairState {
  const customer = (id: string) => scopedRef(namespace, "customer", id);
  const service = (id: string) => scopedRef(namespace, "service", id);
  return { ...state,
    staffRefs: { anna: scopedRef(namespace, "staff", "anna"), erik: scopedRef(namespace, "staff", "erik") },
    customers: state.customers.map(c => ({ ...c, id: customer(c.id) })),
    services: state.services.map(s => ({ ...s, id: service(s.id) })),
    bookings: state.bookings.map(b => ({ ...b, customerId: customer(b.customerId), serviceId: service(b.serviceId) })),
    inbox: state.inbox.map(i => ({ ...i, customerId: i.customerId && customer(i.customerId) })),
  };
}

let template: PairState | undefined;
export function freshSnapshot(today: string) {
  if (!template || template.generatedFor !== today) template = project(createDemoState(today, { pack: "hair" }), true);
  const fresh = scopeEntities(structuredClone(template), randomUUID());
  for (const booking of fresh.bookings) booking.id = randomUUID();
  const friday = fresh.bookings.find(b => b.status === "booked" && b.date > today && weekday(b.date) === 5);
  requirePair(friday, "fixture_unavailable", 503);
  neutralInbox(fresh, friday.id, [randomUUID(), randomUUID()]);
  return fresh;
}

export function snapshot(w: PairWorkspace): PairState {
  const stored = w.snapshot as unknown as PairState;
  // Workspaces saved before waitlist offers have none of their fields; the reducer needs them all.
  const waitlist = initialWaitlist();
  const state = {
    ...stored, industry: stored.industry ?? null, localization: stored.localization ?? defaultBusinessLocalization(hair.id),
    waitlistEntries: stored.waitlistEntries ?? waitlist.waitlistEntries, waitlistOffers: stored.waitlistOffers ?? waitlist.waitlistOffers,
    waitlistGaps: stored.waitlistGaps ?? waitlist.waitlistGaps, waitlistRules: stored.waitlistRules ?? waitlist.waitlistRules,
  };
  if (w.version === 2) return state.staffRefs ? state : scopeEntities(state, w.id);
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
  return scopeEntities(safe, w.id);
}

export const legacyServiceId = (name: string) => "legacy-" + digest(name);
