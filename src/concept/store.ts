"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DemoAction } from "./actions";
import { toKey } from "./data/dates";
import { createDemoState, type BusinessSetup } from "./data/generate";
import { migrateState } from "./data/migrate";
import type { DemoState } from "./data/types";
import { applyAction, defaultMeta } from "./log/capture";
import type { LogMeta } from "./log/types";
import { publicView } from "./selectors";
import { purgeExpired } from "./trash/trash";
import { setVocabulary } from "./i18n";
import { getPack } from "./packs";

// Browser-side demo store: one in-memory state, mirrored to localStorage.
// Pages read it with `useDemo()`; on the server it is `null`, so the studio
// renders a loading shell first and the real UI only in the browser.

const STORAGE_KEY = "salong-eko-demo";
interface BookingReceipt { day: string; seq: number }
let state: DemoState | null = null;
let savedRaw: string | null | undefined;
let savedVersion: BookingReceipt | undefined;
let lastWrittenVersion: BookingReceipt | undefined;
const listeners = new Set<() => void>();

function today() {
  return toKey(new Date());
}

function load(raw: string | null): DemoState {
  try {
    const saved = raw && migrateState(JSON.parse(raw));
    if (saved && saved.generatedFor === today()) return purgeExpired(saved, today());
  } catch {
    // A corrupt snapshot falls back to fresh demo data.
  }
  return createDemoState(today());
}

function refreshFromStorage() {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  if (raw === savedRaw) return false;
  savedRaw = raw;
  state = adopt(load(raw));
  savedVersion = raw ? { day: state.generatedFor, seq: state.seq } : undefined;
  listeners.forEach((listener) => listener());
  return true;
}

function onStorage(event: StorageEvent) {
  if (event.storageArea === window.localStorage && (event.key === STORAGE_KEY || event.key === null)) refreshFromStorage();
}

/** The words of the business's industry pack apply as soon as its state is current. */
function adopt(next: DemoState) {
  setVocabulary(getPack(next.pack).vocabulary);
  return next;
}

function setState(next: DemoState, recheckStorage = false): boolean {
  try {
    const raw = JSON.stringify(next);
    if (recheckStorage && refreshFromStorage()) return false;
    window.localStorage.setItem(STORAGE_KEY, raw);
    savedRaw = raw;
    savedVersion = lastWrittenVersion = { day: next.generatedFor, seq: next.seq };
  } catch {
    // The demo still works in memory.
  }
  state = adopt(next);
  listeners.forEach((listener) => listener());
  return true;
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  refreshFromStorage();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): DemoState | null {
  if (!state && typeof window !== "undefined") {
    refreshFromStorage();
    state ??= adopt(load(null));
  }
  return state;
}

/** The current state outside React, for code that just dispatched and needs the result. */
export function currentState(): DemoState | null {
  return getSnapshot();
}

/**
 * Applies an action and records it in the activity log. `meta` says who and
 * where it came from when that is not "the owner pressed a button".
 * Returns false when nothing changed (e.g. the slot was taken).
 */
export function dispatch(action: DemoAction, meta?: Partial<Omit<LogMeta, "at">>): boolean {
  return dispatchWithLog(action, meta) !== false;
}

/**
 * Returns the new log entry ID, null for an unlogged change, or false on refusal.
 * A caller's guard runs against the same refreshed state as the action.
 */
export function dispatchWithLog(
  action: DemoAction,
  meta?: Partial<Omit<LogMeta, "at">>,
  canApply?: (current: DemoState) => boolean,
): string | null | false {
  if (typeof window !== "undefined") refreshFromStorage();
  const now = Date.now();
  const logMeta = { ...defaultMeta(action, now), ...meta, at: now };
  while (true) {
    const current = getSnapshot();
    if (!current || (canApply && !canApply(current))) return false;
    const next = applyAction(current, action, logMeta);
    if (next === current) return false;
    // Run the booking rules again if another tab wrote while we prepared the save.
    if (!setState(next, action.type === "online/book" || !!canApply)) continue;
    const logId = next.log[0]?.id;
    return logId !== current.log[0]?.id ? logId ?? null : null;
  }
}

// Web Locks serialize callbacks, but another renderer can still read an older
// localStorage snapshot after acquiring the lock. Cache Storage supplies a
// shared receipt for the last saved sequence. It contains no booking details.
async function bookingReceipts(): Promise<Cache | undefined> {
  try {
    return await window.caches.open("concept-booking-sequence");
  } catch {
    // Embedded or private contexts can deny persistent storage.
  }
}

async function withBookingReceipt<T>(write: (required?: BookingReceipt) => T, reset = false): Promise<T | false> {
  if (typeof window === "undefined" || !navigator.locks) return write();
  return navigator.locks.request(STORAGE_KEY, async () => {
    const receipts = await bookingReceipts();
    if (!receipts) return write();
    const receiptKey = new URL("/concept-booking-sequence", window.location.origin).href;
    const receipt = await receipts.match(receiptKey).catch(() => undefined);
    const latest: BookingReceipt | undefined = await receipt?.json().catch(() => undefined);
    const required = latest?.day === today() ? latest : undefined;
    if (required && !reset) {
      // A missing snapshot can still be an older renderer's view of storage.
      for (let attempt = 0; ; attempt++) {
        refreshFromStorage();
        if (savedVersion?.day === required.day && savedVersion.seq >= required.seq) break;
        if (attempt === 40) return false;
        await new Promise(resolve => window.setTimeout(resolve, 25));
      }
    }
    const before = lastWrittenVersion;
    const result = write(required);
    if (lastWrittenVersion && lastWrittenVersion !== before) {
      // A storage quota error must not hide an appointment already saved.
      await receipts.put(receiptKey, Response.json(lastWrittenVersion)).catch(() => undefined);
    }
    return result;
  });
}

export function withBookingLock<T>(confirm: () => T): Promise<T | false> {
  return withBookingReceipt(confirm);
}

/** Rebuilds the demo for a business setup (industry pack, team size, modules). Without one it is the original Salong Eko. */
export async function startBusiness(setup?: BusinessSetup): Promise<void> {
  await withBookingReceipt(required => {
    const next = createDemoState(today(), setup);
    if (typeof window !== "undefined") refreshFromStorage();
    // Supersede the previous receipt so stale tabs must also wait for this reset.
    const currentSeq = state?.generatedFor === next.generatedFor ? state.seq : 0;
    next.seq = Math.max(next.seq, currentSeq + 1, (required?.seq ?? 0) + 1);
    setState(next);
  }, true);
}

export function useDemo(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** The state for the booking pages: what customers may see and book (hidden treatments are not on offer). */
export function usePublicDemo(): DemoState | null {
  const state = useDemo();
  return useMemo(() => state && publicView(state), [state]);
}
