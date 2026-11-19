"use client";

import { useSyncExternalStore } from "react";
import { toKey } from "./data/dates";
import { salonClock } from "./tools/clock";

/** Current day and minute of day, refreshed every 30 seconds. */
export interface Now {
  today: string;
  minutes: number;
  /** Distinguishes the two occurrences of a local minute when clocks go back. */
  instant?: number;
}

let cached: Now | null = null;
let cachedSalon: Now | null = null;

export function readNow(): Now {
  const d = new Date();
  const today = toKey(d);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (!cached || cached.today !== today || cached.minutes !== minutes) cached = { today, minutes };
  return cached;
}

export function readSalonNow(): Now {
  const instant = Date.now();
  const minute = Math.floor(instant / 60_000) * 60_000;
  // Deadlines are on minute boundaries and free cancellation includes the exact cutoff.
  // Cache a stable snapshot on each side of that instant for useSyncExternalStore.
  const previous = cachedSalon?.instant;
  if (previous === undefined || previous < minute || previous > instant || (previous === minute && instant > minute)) {
    cachedSalon = { ...salonClock(new Date(instant)), instant };
  }
  return cachedSalon!;
}

function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 30_000);
  return () => window.clearInterval(timer);
}

const serverNow: Now = { today: "1970-01-01", minutes: 0 };

export function useNow(): Now {
  return useSyncExternalStore(subscribe, readNow, () => serverNow);
}

export function subscribeSalonClock(listener: () => void) {
  let timer: number;
  function schedule() {
    const elapsed = Date.now() % 60_000;
    timer = window.setTimeout(() => {
      schedule();
      listener();
    }, elapsed === 0 ? 1 : 60_000 - elapsed);
  }
  schedule();
  return () => window.clearTimeout(timer);
}

export function useSalonNow(): Now {
  return useSyncExternalStore(subscribeSalonClock, readSalonNow, () => serverNow);
}
