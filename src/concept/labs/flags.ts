"use client";

import { useSyncExternalStore } from "react";

// Lab features: early tools the owner switches on in this browser, under
// Advanced. They live next to the demo store, not in the salon document, so
// they never travel to another device or change what customers see. Each is off
// until switched on, and off when the browser cannot say.

export type LabFlag = "voiceAssistant";

const STORAGE_KEY = "salong-eko-labs";

type Flags = Partial<Record<LabFlag, boolean>>;

const listeners = new Set<() => void>();
let cache: Flags | null = null;

function read(): Flags {
  if (cache) return cache;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    cache = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Flags) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Whether a lab feature is on in this browser. */
export function labFlag(flag: LabFlag): boolean {
  if (typeof window === "undefined") return false;
  return read()[flag] === true;
}

export function setLabFlag(flag: LabFlag, on: boolean) {
  cache = { ...read(), [flag]: on };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // The choice then lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab switched it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** A lab feature's switch, kept in step across the page. Off on the server and in the first render. */
export function useLabFlag(flag: LabFlag): boolean {
  return useSyncExternalStore(subscribe, () => labFlag(flag), () => false);
}
