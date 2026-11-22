import type { DateKey, DemoState, Processing, Service, ServiceCategory, StaffId } from "../data/types";

// The price list as the owner edits it: treatments and their headings. Pure
// functions; the reducer calls `applyServiceAction`, and the form asks
// `serviceIssues` the same question before it lets the owner save.

export const MIN_DURATION = 5;
export const MAX_DURATION = 8 * 60;
export const DURATION_STEP = 5;
export const MAX_PRICE = 100_000;
export const MAX_BUFFER = 120;
export const MAX_NAME = 60;
export const MAX_DESCRIPTION = 240;
const DEFAULT_RECALL_WEEKS = 6;

/** What the owner fills in for a treatment. */
export interface ServiceDraft {
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
  staffIds: StaffId[];
  /** Left out or 0 = none. */
  bufferBefore?: number;
  bufferAfter?: number;
  /** Left out = the staff member is busy for the whole treatment. */
  processing?: Processing;
}

export type ServiceIssue = "name" | "nameTaken" | "category" | "duration" | "price" | "staff" | "description" | "buffer" | "processing";
export type CategoryIssue = "name" | "nameTaken";
export type Direction = "up" | "down";

export type ServiceAction =
  | { type: "service/add"; service: ServiceDraft }
  | { type: "service/update"; id: string; service: ServiceDraft }
  | { type: "service/visibility"; id: string; hidden: boolean }
  /** `name` is the copy's name as the caller words it ("Spa foot care (copy)"); a number is added if it is taken. */
  | { type: "service/duplicate"; id: string; name: string }
  | { type: "service/delete"; id: string }
  | { type: "service/move"; id: string; direction: Direction }
  | { type: "service/reorder"; category: string; ids: string[] }
  | { type: "category/add"; name: string }
  | { type: "category/rename"; id: string; name: string }
  | { type: "category/remove"; id: string }
  | { type: "category/move"; id: string; direction: Direction }
  | { type: "category/reorder"; ids: string[] };

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const nameTaken = (state: DemoState, name: string, category: string, ignoreId?: string) =>
  state.services.some((s) => s.id !== ignoreId && s.category === category && same(s.name, name));

export function validServicePrice(price: number): boolean {
  return price >= 0 && price <= MAX_PRICE && price === Math.round(price * 100) / 100;
}

const validMinutes = (minutes: number, min: number, max: number) => Number.isInteger(minutes) && minutes >= min && minutes <= max && minutes % DURATION_STEP === 0;

function validProcessing({ processing, duration }: ServiceDraft): boolean {
  if (processing === undefined) return true;
  return !!processing && validMinutes(processing.after, 0, MAX_DURATION) && validMinutes(processing.duration, DURATION_STEP, MAX_DURATION) && processing.after + processing.duration <= duration;
}

/** What stops a treatment from being saved; empty when it is fine. `ignoreId` is the treatment being edited. */
export function serviceIssues(state: DemoState, draft: ServiceDraft, ignoreId?: string): ServiceIssue[] {
  const issues: ServiceIssue[] = [];
  const name = draft.name.trim();
  if (!name || name.length > MAX_NAME) issues.push("name");
  else if (nameTaken(state, name, draft.category, ignoreId)) issues.push("nameTaken");
  if (!state.categories.some((c) => c.id === draft.category)) issues.push("category");
  if (!Number.isInteger(draft.duration) || draft.duration < MIN_DURATION || draft.duration > MAX_DURATION || draft.duration % DURATION_STEP !== 0) issues.push("duration");
  if (!validServicePrice(draft.price)) issues.push("price");
  if (!draft.staffIds.length || new Set(draft.staffIds).size !== draft.staffIds.length || !draft.staffIds.every((id) => state.staff.some((p) => p.id === id))) issues.push("staff");
  if (draft.description.trim().length > MAX_DESCRIPTION) issues.push("description");
  if (![draft.bufferBefore ?? 0, draft.bufferAfter ?? 0].every((minutes) => validMinutes(minutes, 0, MAX_BUFFER))) issues.push("buffer");
  if (!validProcessing(draft)) issues.push("processing");
  return issues;
}

export function categoryIssues(state: DemoState, name: string, ignoreId?: string): CategoryIssue[] {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME) return ["name"];
  return state.categories.some((c) => c.id !== ignoreId && same(c.name, trimmed)) ? ["nameTaken"] : [];
}

/** Everything that still points at a treatment, so the owner sees what deleting it means. */
export interface ServiceUsage {
  /** Booked visits from today on. */
  upcoming: number;
  /** Visits that already happened or were cancelled. */
  past: number;
  /** Punch cards with visits left. */
  packages: number;
  /** Campaigns that are running or planned. */
  campaigns: number;
}

export function serviceUsage(state: DemoState, id: string, today: DateKey): ServiceUsage {
  const bookings = state.bookings.filter((b) => b.serviceId === id);
  const upcoming = bookings.filter((b) => b.status === "booked" && b.date >= today).length;
  return {
    upcoming,
    past: bookings.length - upcoming,
    packages: state.packages.filter((p) => p.serviceId === id && p.usedBy.length < p.visits).length,
    campaigns: state.campaigns.filter((c) => c.serviceIds.includes(id) && (c.status === "active" || c.status === "planned")).length,
  };
}

/** True when a record somewhere, even one in the trash, still needs the treatment's name, price or rooms. */
export function serviceIsReferenced(state: DemoState, id: string): boolean {
  return state.bookings.some((b) => b.serviceId === id) || state.checkoutHolds.some((h) => h.serviceId === id) || state.trash.some((e) => e.kind === "customer" && e.bookings.some((b) => b.serviceId === id)) || state.packages.some((p) => p.serviceId === id) || state.campaigns.some((c) => c.serviceIds.includes(id));
}

/** Timing fields that are zero or unset are left out, so a service without them stays as it was. */
const NO_TIMING = { bufferBefore: undefined, bufferAfter: undefined, processing: undefined };

const clean = ({ bufferBefore, bufferAfter, processing, ...draft }: ServiceDraft): ServiceDraft => ({
  ...draft,
  name: draft.name.trim(),
  description: draft.description.trim(),
  staffIds: [...draft.staffIds],
  ...(bufferBefore ? { bufferBefore } : {}),
  ...(bufferAfter ? { bufferAfter } : {}),
  ...(processing ? { processing: { after: processing.after, duration: processing.duration } } : {}),
});

function movedIds(items: { id: string }[], id: string, direction: Direction): string[] {
  const ids = items.map((item) => item.id);
  const from = ids.indexOf(id);
  const to = from + (direction === "up" ? -1 : 1);
  if (from >= 0 && to >= 0 && to < ids.length) [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** Fill the group's existing slots, preserving the order and positions of other groups. */
function reorderWithin<T extends { id: string }>(list: T[], group: T[], ids: string[]): T[] {
  if (!Array.isArray(ids) || ids.length !== group.length || new Set(ids).size !== group.length) return list;
  const byId = new Map(group.map((item) => [item.id, item]));
  const reordered: T[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) return list;
    reordered.push(item);
  }
  if (reordered.every((item, index) => item === group[index])) return list;
  let index = 0;
  return list.map((item) => byId.has(item.id) ? reordered[index++] : item);
}

function freeName(state: DemoState, wanted: string, category: string): string {
  if (!nameTaken(state, wanted, category)) return wanted;
  let n = 2;
  while (nameTaken(state, `${wanted} ${n}`, category)) n += 1;
  return `${wanted} ${n}`;
}

/** An invalid or pointless change returns the state untouched, so nothing is logged. */
export function applyServiceAction(state: DemoState, action: ServiceAction): DemoState {
  switch (action.type) {
    case "service/add": {
      if (serviceIssues(state, action.service).length) return state;
      const service: Service = { ...clean(action.service), id: `svc-${state.seq}`, recallWeeks: DEFAULT_RECALL_WEEKS, resourceIds: state.resources.map((r) => r.id) };
      return { ...state, seq: state.seq + 1, services: [...state.services, service] };
    }
    case "service/update": {
      if (!state.services.some((s) => s.id === action.id) || serviceIssues(state, action.service, action.id).length) return state;
      return { ...state, services: state.services.map((s) => (s.id === action.id ? { ...s, ...NO_TIMING, ...clean(action.service) } : s)) };
    }
    case "service/visibility": {
      const service = state.services.find((s) => s.id === action.id);
      if (!service || !!service.hidden === action.hidden) return state;
      return { ...state, services: state.services.map((s) => (s.id === action.id ? { ...s, hidden: action.hidden } : s)) };
    }
    case "service/duplicate": {
      const index = state.services.findIndex((s) => s.id === action.id);
      const name = action.name.trim().slice(0, MAX_NAME);
      if (index < 0 || !name) return state;
      const source = state.services[index];
      // A copy starts hidden: it is a draft until the owner has made it its own.
      const copy: Service = { ...source, id: `svc-${state.seq}`, name: freeName(state, name, source.category), hidden: true };
      return { ...state, seq: state.seq + 1, services: [...state.services.slice(0, index + 1), copy, ...state.services.slice(index + 1)] };
    }
    case "service/delete": {
      const service = state.services.find((s) => s.id === action.id);
      // The last treatment stays: a business with nothing to book cannot take a booking.
      if (!service || state.services.length === 1) return state;
      return {
        ...state,
        services: state.services.filter((s) => s.id !== action.id),
        // Bookings keep their own time, length and price; the retired copy keeps their name and room readable.
        retiredServices: serviceIsReferenced(state, action.id) ? [...state.retiredServices, service] : state.retiredServices,
      };
    }
    case "service/move":
    case "service/reorder": {
      const category = action.type === "service/reorder" ? action.category : state.services.find((s) => s.id === action.id)?.category;
      if (!state.categories.some((c) => c.id === category)) return state;
      const group = state.services.filter((s) => s.category === category);
      const ids = action.type === "service/reorder" ? action.ids : movedIds(group, action.id, action.direction);
      const services = reorderWithin(state.services, group, ids);
      return services === state.services ? state : { ...state, services };
    }
    case "category/add": {
      if (categoryIssues(state, action.name).length) return state;
      const category: ServiceCategory = { id: `cat-${state.seq}`, name: action.name.trim() };
      return { ...state, seq: state.seq + 1, categories: [...state.categories, category] };
    }
    case "category/rename": {
      const category = state.categories.find((c) => c.id === action.id);
      if (!category || categoryIssues(state, action.name, action.id).length || category.name === action.name.trim()) return state;
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? { ...c, name: action.name.trim() } : c)) };
    }
    case "category/remove": {
      // Only an empty heading can go: treatments are moved or deleted first, never dropped along with it.
      if (!state.categories.some((c) => c.id === action.id) || state.services.some((s) => s.category === action.id)) return state;
      return { ...state, categories: state.categories.filter((c) => c.id !== action.id) };
    }
    case "category/move":
    case "category/reorder": {
      const ids = action.type === "category/reorder" ? action.ids : movedIds(state.categories, action.id, action.direction);
      const categories = reorderWithin(state.categories, state.categories, ids);
      return categories === state.categories ? state : { ...state, categories };
    }
  }
}
