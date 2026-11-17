import type { DemoState, Staff, StaffId } from "../data/types";
import type { IntentAction } from "../intent";

// Who is looking: the owner sees everything, a staff member only the own day.
// This file is the one place that decides it, and it is plain functions so the
// server (MCP tools) can use it too. The browser's choice of role lives in
// `role.ts`. The navigation, every page and the command box ask `canOpen` and
// `canCommand` instead of checking roles themselves.

export type Role = "owner" | "staff";

/** The team member the staff view stands for: the first one who is not the owner. Null in a one-person business. */
export function staffViewer(state: DemoState): Staff | null {
  return state.staff[1] ?? null;
}

/** Ids of the customers a staff member has served or is booked to serve. */
export function servedBy(state: DemoState, staffId: StaffId): Set<string> {
  return new Set(state.bookings.filter((b) => b.staffId === staffId).map((b) => b.customerId));
}

/** Pages a staff member may open: their day, their calendar, and the customers they serve with the journal. */
const STAFF_PAGES = [/^\/studio$/, /^\/studio\/calendar$/, /^\/studio\/customers$/, /^\/studio\/customers\/(?!import$|due-back$)[^/]+$/];

export function canOpen(role: Role, pathname: string): boolean {
  return role === "owner" || STAFF_PAGES.some((page) => page.test(pathname));
}

/** What a staff member can ask the command box for: bookings only, no numbers, prices, stock or campaigns. */
const STAFF_COMMANDS: (IntentAction | "question")[] = ["book", "move", "cancel", "question"];

export function canCommand(role: Role, action: IntentAction | "question"): boolean {
  return role === "owner" || STAFF_COMMANDS.includes(action);
}
