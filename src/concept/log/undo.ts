import { isActive, isFree, pickResource } from "../data/slots";
import { cardsCovered } from "../giftcards/cards";
import type { DemoState } from "../data/types";
import { serviceIsReferenced } from "../services/edit";
import { patchConflict, revertPatch } from "./patch";
import type { LogEntry, StatePatch } from "./types";

export type UndoBlockReason = "changed" | "created-changed" | "record-in-use" | "time-taken" | "customer-in-use" | "gift-card";

/** True when the undo would remove a customer that a record left in the state still points to. */
function orphansCustomer(state: DemoState, reverted: DemoState): boolean {
  const kept = new Set(reverted.customers.map((customer) => customer.id));
  const removed = state.customers.filter((customer) => !kept.has(customer.id)).map((customer) => customer.id);
  if (!removed.length) return false;
  const gone = new Set(removed);
  return Object.values(reverted).some(
    (value) => Array.isArray(value) && value.some((item) => typeof item?.customerId === "string" && gone.has(item.customerId)),
  );
}

/** Check references in the state the undo would leave behind. */
function orphansCreatedRecord(state: DemoState, { collections }: StatePatch): boolean {
  const removed = (key: string) => collections[key]?.added.flatMap((item) => typeof item === "string" ? [] : [item.id]) ?? [];
  const bundles = state.trash.filter((entry) => entry.kind === "customer");
  const trashedBookings = bundles.flatMap((entry) => entry.bookings);
  const services = [...state.services, ...state.retiredServices];

  return [...removed("services"), ...removed("retiredServices")].some((id) =>
    !services.some((service) => service.id === id) && (
      serviceIsReferenced(state, id) || trashedBookings.some((booking) => booking.serviceId === id) ||
      bundles.some((entry) => entry.packages?.some((pkg) => pkg.serviceId === id) || entry.inbox.some((item) => item.suggestion?.serviceId === id || item.recallServiceId === id)) ||
      state.inbox.some((item) => item.suggestion?.serviceId === id || item.recallServiceId === id) ||
      state.holidays.some((holiday) => holiday.serviceIds.includes(id))
    ),
  ) || removed("bookings").some((id) =>
    !trashedBookings.some((booking) => booking.id === id) && (
      [state.journals, state.reviews, state.inbox, ...bundles.flatMap((entry) => [entry.journals, entry.reviews, entry.inbox])]
        .some((items) => items.some((item) => item.bookingId === id)) ||
      state.giftCards.some((card) => card.redemptions.some((item) => item.bookingId === id)) ||
      state.packages.some((pkg) => pkg.usedBy.includes(id)) ||
      bundles.some((entry) => entry.packages?.some((pkg) => pkg.usedBy.includes(id))) ||
      state.trash.some((entry) => entry.kind === "booking" && entry.bookingId === id)
    ),
  ) || removed("categories").some((id) =>
    services.some((service) => service.category === id) || state.customers.some((customer) => customer.category === id),
  ) || removed("resources").some((id) =>
    services.some((service) => service.resourceIds?.includes(id)) ||
    [state.bookings, trashedBookings].some((bookings) => bookings.some((booking) => booking.resourceId === id)),
  ) || removed("reviews").some((id) =>
    !bundles.some((entry) => entry.reviews.some((review) => review.id === id)) &&
    [state.inbox, ...bundles.map((entry) => entry.inbox)].some((items) => items.some((item) => item.reviewId === id)),
  );
}

function previewUndo(state: DemoState, entry?: LogEntry): DemoState | UndoBlockReason {
  if (!entry?.patch || entry.undone) return "changed";
  const conflict = patchConflict(state, entry.patch);
  if (conflict) return conflict;
  const reverted = revertPatch(state, entry.patch);
  if (orphansCustomer(state, reverted)) return "customer-in-use";
  if (orphansCreatedRecord(reverted, entry.patch)) return "record-in-use";
  if (!cardsCovered(reverted)) return "gift-card";
  if (!entry.patch.collections.bookings) return reverted;

  const current = new Map(state.bookings.map((booking) => [booking.id, booking]));
  for (const [index, booking] of reverted.bookings.entries()) {
    if (!isActive(booking)) continue;
    const { id, staffId, date, start } = booking;
    const beforeUndo = current.get(id);
    const restored = booking.status === "booked" && beforeUndo?.status !== "booked";
    const moved = beforeUndo && (beforeUndo.staffId !== staffId || beforeUndo.date !== date || beforeUndo.start !== start);
    if (!restored && !moved) continue;

    if (!isFree(reverted, staffId, date, start, booking, id)) return "time-taken";
    // The bookings patch gives the reverted state its own array. Reserve the
    // room here so the next restored booking sees it too.
    reverted.bookings[index] = { ...booking, resourceId: pickResource(reverted, booking, date, start, id) };
  }
  return reverted;
}

/** The reason a log entry cannot be undone, if any. */
export function undoBlockReason(state: DemoState, entry?: LogEntry): UndoBlockReason | undefined {
  const result = previewUndo(state, entry);
  return typeof result === "string" ? result : undefined;
}

export function isUndoable(state: DemoState, entry: LogEntry): boolean {
  return !undoBlockReason(state, entry);
}

/** The entry a change made: by its id, or by the operation id a tab handed out before its commit (`LogMeta.op`). */
export function findLogEntry(log: readonly LogEntry[], id: string): LogEntry | undefined {
  return log.find((e) => e.id === id) ?? log.find((e) => e.op === id && e.type !== "waitlist/event");
}

/** Whether the log entry with this id exists and can still be undone (it may have been evicted from the log). */
export function canUndo(state: DemoState, id: string): boolean {
  const entry = findLogEntry(state.log, id);
  return !!entry && isUndoable(state, entry);
}

/** Takes one change back. The entry stays in the log, marked as undone. */
export function undoEntry(state: DemoState, id: string): DemoState {
  const entry = findLogEntry(state.log, id);
  const reverted = previewUndo(state, entry);
  if (typeof reverted === "string" || !entry) return state;
  return { ...reverted, log: reverted.log.map((e) => (e.id === entry.id ? { ...e, undone: true } : e)) };
}
