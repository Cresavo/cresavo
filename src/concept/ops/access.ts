"use client";

import { useSyncExternalStore } from "react";
import type { DemoState, Staff, StaffId } from "../data/types";
import type { IntentAction } from "../intent";

// Who is looking: the owner sees everything, a staff member only the own day.
// This file is the one place that decides it. The navigation, every page and
// the command box ask `canOpen`, `canCommand` and `useRole` instead of
// checking roles themselves.

export type Role = "owner" | "staff";

const STORAGE_KEY = "salong-eko-role";

let role: Role | null = null;
const listeners = new Set<() => void>();

function read(): Role {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "staff" ? "staff" : "owner";
  } catch {
    return "owner";
  }
}

function snapshot(): Role {
  role ??= read();
  return role;
}

export function setRole(next: Role) {
  role = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice then lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

export function useRole(): Role {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot,
    () => "owner",
  );
}

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
