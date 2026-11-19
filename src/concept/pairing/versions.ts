import type { DemoAction } from "../actions";
import { applyAction } from "../log/capture";
import type { LogMeta } from "../log/types";
import type { Interval, StaffId } from "../data/types";
import type { PairState } from "./fixture";

// Dependencies distinguish the version read for a draft from the entities it actually changes.
export function preconditions(state: PairState, action: DemoAction): Record<string, number> {
  const version = (key: string) => state.entityVersions?.[key] ?? 0;
  switch (action.type) {
    case "booking/move":
    case "booking/cancel":
      return { ["booking:" + action.id]: state.bookingVersions?.[action.id] ?? 0 };
    case "staff/block":
    case "booking/create": {
      const day = `schedule:${action.staffId}:${action.date}`;
      const end = action.type === "staff/block" ? action.end : action.start + (state.services.find(s => s.id === action.serviceId)?.duration ?? 0);
      const history = state.scheduleChanges?.[day] ?? [];
      const versions: Record<string, number> = { [day]: history.filter(i => action.start < i.end && end > i.start).length };
      if (action.type === "booking/create") {
        const service = "service:" + action.serviceId;
        versions[service] = version(service);
        if ("customerId" in action) versions["customer:" + action.customerId] = version("customer:" + action.customerId);
      }
      return versions;
    }
    case "service/visibility":
    case "service/price":
    case "inbox/reply": {
      const key = (action.type === "inbox/reply" ? "item:" : "service:") + action.id;
      return { [key]: version(key) };
    }
    default: throw new Error("unsupported_proposal");
  }
}

export function applyVersioned(state: PairState, action: DemoAction, meta: LogMeta): PairState {
  const next = applyAction(state, action, meta);
  if (next === state) return state;
  const versions = { ...state.entityVersions };
  const bookings = { ...state.bookingVersions };
  const bump = (key: string) => { versions[key] = (versions[key] ?? 0) + 1; };
  // At most two intervals per schedule edit, bounded by the lifetime proposal quota.
  // Only overlapping intervals invalidate a pending booking or block.
  const scheduleChanges = { ...state.scheduleChanges };
  const schedule = (b: { staffId: StaffId; date: string; start: number }, end: number) => {
    const day = `schedule:${b.staffId}:${b.date}`;
    const changed: Interval = { start: b.start, end };
    scheduleChanges[day] = [...(scheduleChanges[day] ?? []), changed];
  };
  switch (action.type) {
    case "booking/move":
    case "booking/cancel": {
      const old = state.bookings.find(b => b.id === action.id)!;
      schedule(old, old.start + old.duration);
      if (action.type === "booking/move") schedule({ ...action, staffId: action.staffId ?? old.staffId }, action.start + old.duration);
      bookings[action.id] = (bookings[action.id] ?? 0) + 1;
      break;
    }
    case "booking/create": {
      const booking = next.bookings.at(-1)!;
      schedule(booking, booking.start + booking.duration);
      break;
    }
    case "staff/block":
      schedule(action, action.end);
      break;
    case "service/visibility":
    case "service/price":
      bump("service:" + action.id);
      break;
    case "inbox/reply":
      bump("item:" + action.id);
      break;
    default: throw new Error("unsupported_proposal");
  }
  return { ...next, scheduleChanges, entityVersions: versions, bookingVersions: bookings };
}
