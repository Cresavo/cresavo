import { canBlock } from "../data/slots";
import type { StaffBlock, DateKey, DemoState, Resource, ResourceKind, Salon, Staff, StaffException, StaffId, TimeOffReason } from "../data/types";

// Changes to when the business is open, who works when and which rooms exist.
// They only edit the plan: bookings that no longer fit stay where they are and
// show up as "needs moving" (see needs-moving.ts) for the owner to decide.

export type OpsAction =
  | ({ type: "staff/block" } & Omit<StaffBlock, "id">)
  | { type: "salon/hours"; hours: Salon["hours"]; lunch: Salon["lunch"] }
  | { type: "salon/close"; date: DateKey; name: string }
  | { type: "salon/reopen"; id: string }
  | { type: "staff/week"; staffId: StaffId; week: Staff["week"] }
  | { type: "staff/off"; staffId: StaffId; dates: DateKey[]; reason: TimeOffReason }
  | { type: "staff/shift"; staffId: StaffId; date: DateKey; start: number; end: number }
  | { type: "staff/exception-remove"; id: string }
  | { type: "resource/add"; name: string; kind: ResourceKind }
  | { type: "resource/rename"; id: string; name: string }
  | { type: "resource/remove"; id: string }
  | { type: "service/resources"; id: string; resourceIds: string[] };

export function weekFromHours(hours: Salon["hours"]): Staff["week"] {
  return Object.fromEntries(Object.entries(hours).map(([day, span]) =>
    [day, span ? { start: span.open, end: span.close } : null]));
}

const DAY = 24 * 60;

const validSpan = (from: number, to: number) => Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to <= DAY && from < to;

const validDate = (date: DateKey) => /^\d{4}-\d{2}-\d{2}$/.test(date);

function addException(state: DemoState, staffId: StaffId, date: DateKey, detail: { kind: "off"; reason: TimeOffReason } | { kind: "shift"; start: number; end: number }): DemoState {
  const kept = state.exceptions.filter((e) => !(e.staffId === staffId && e.date === date));
  const exception: StaffException = { id: `ex-${state.seq}`, staffId, date, ...detail };
  return { ...state, seq: state.seq + 1, exceptions: [...kept, exception] };
}

export function applyOps(state: DemoState, action: OpsAction): DemoState {
  switch (action.type) {
    case "salon/hours": {
      const hoursOk = Object.values(action.hours).every((day) => !day || validSpan(day.open, day.close));
      if (!hoursOk || (action.lunch && !validSpan(action.lunch.start, action.lunch.end))) return state;
      // Follow the salon's hours until the owner gives a person an individual schedule.
      const staff = state.industry ? state.staff.map(person => {
        const followsSalon = [0, 1, 2, 3, 4, 5, 6].every(day =>
          person.week[day]?.start === state.salon.hours[day]?.open && person.week[day]?.end === state.salon.hours[day]?.close);
        return followsSalon ? { ...person, week: weekFromHours(action.hours) } : person;
      }) : state.staff;
      // Drop the standard-demo day pins (date openings and 09:00–18:00 shifts) so later hours follow the edited plan.
      return { ...state, staff, exceptions: state.exceptions.filter((e) => !e.id.startsWith("e-eko-today-") && !e.id.startsWith("e-eko-next-")), salon: { ...state.salon, hours: action.hours, lunch: action.lunch, openings: undefined } };
    }
    case "salon/close": {
      const name = action.name.trim();
      if (!validDate(action.date) || !name) return state;
      const kept = state.salon.closures.filter((c) => c.date !== action.date);
      const closures = [...kept, { id: `cl-${state.seq}`, date: action.date, name }].sort((a, b) => a.date.localeCompare(b.date));
      return { ...state, seq: state.seq + 1, salon: { ...state.salon, closures } };
    }
    case "salon/reopen":
      return { ...state, salon: { ...state.salon, closures: state.salon.closures.filter((c) => c.id !== action.id) } };
    case "staff/block": {
      const { staffId, date, start, end, reason } = action;
      if (!validDate(date) || !canBlock(state, staffId, date, start, end)) return state;
      const block = { id: `block-${state.seq}`, staffId, date, start, end, reason };
      return { ...state, seq: state.seq + 1, blocks: [...(state.blocks ?? []), block] };
    }
    case "staff/week": {
      if (!state.staff.some((s) => s.id === action.staffId) || !Object.values(action.week).every((day) => !day || validSpan(day.start, day.end))) return state;
      return { ...state, staff: state.staff.map((s) => (s.id === action.staffId ? { ...s, week: action.week } : s)) };
    }
    case "staff/off": {
      if (!state.staff.some((s) => s.id === action.staffId) || !action.dates.length || !action.dates.every(validDate)) return state;
      return [...new Set(action.dates)].reduce((next, date) => addException(next, action.staffId, date, { kind: "off", reason: action.reason }), state);
    }
    case "staff/shift": {
      if (!state.staff.some((s) => s.id === action.staffId) || !validDate(action.date) || !validSpan(action.start, action.end)) return state;
      return addException(state, action.staffId, action.date, { kind: "shift", start: action.start, end: action.end });
    }
    case "staff/exception-remove":
      return { ...state, exceptions: state.exceptions.filter((e) => e.id !== action.id) };
    case "resource/add": {
      const name = action.name.trim();
      if (!name) return state;
      const resource: Resource = { id: `res-${state.seq}`, name, kind: action.kind };
      return { ...state, seq: state.seq + 1, resources: [...state.resources, resource] };
    }
    case "resource/rename": {
      const name = action.name.trim();
      if (!name) return state;
      return { ...state, resources: state.resources.map((r) => (r.id === action.id ? { ...r, name } : r)) };
    }
    case "resource/remove":
      return {
        ...state,
        resources: state.resources.filter((r) => r.id !== action.id),
        services: state.services.map((s) => (s.resourceIds?.includes(action.id) ? { ...s, resourceIds: s.resourceIds.filter((id) => id !== action.id) } : s)),
        bookings: state.bookings.map((b) => (b.resourceId === action.id ? { ...b, resourceId: undefined } : b)),
      };
    case "service/resources":
      if (!action.resourceIds.every((id) => state.resources.some((r) => r.id === id))) return state;
      return { ...state, services: state.services.map((s) => (s.id === action.id ? { ...s, resourceIds: action.resourceIds } : s)) };
  }
}
