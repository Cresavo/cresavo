"use client";

import { useSyncExternalStore } from "react";
import { toKey } from "./data/dates";
import { salonClock } from "./tools/clock";

/** Current day and minute of day, refreshed every 30 seconds. */
export interface Now {
  today: string;
  minutes: number;
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

function readSalonNow(): Now {
  const now = salonClock();
  if (!cachedSalon || cachedSalon.today !== now.today || cachedSalon.minutes !== now.minutes) cachedSalon = now;
  return cachedSalon;
}

function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 30_000);
  return () => window.clearInterval(timer);
}

const serverNow: Now = { today: "1970-01-01", minutes: 0 };

export function useNow(): Now {
  return useSyncExternalStore(subscribe, readNow, () => serverNow);
}

export function useSalonNow(): Now {
  return useSyncExternalStore(subscribe, readSalonNow, () => serverNow);
}
