"use client";

import { useSyncExternalStore } from "react";
import { currentState } from "../store";
import { staffViewer, type Role } from "./access";

// The demo's Owner / Staff switch, kept in the browser. Not authentication.

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

export function currentRole(): Role {
  const salon = currentState();
  if (salon && !staffViewer(salon)) return "owner";
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
    currentRole,
    () => "owner",
  );
}
