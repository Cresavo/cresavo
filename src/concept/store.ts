"use client";

import { useSyncExternalStore } from "react";
import type { DemoAction } from "./actions";
import { toKey } from "./data/dates";
import { createDemoState, type BusinessSetup } from "./data/generate";
import { migrateState } from "./data/migrate";
import type { DemoState } from "./data/types";
import { applyAction, defaultMeta } from "./log/capture";
import type { LogMeta } from "./log/types";
import { purgeExpired } from "./trash/trash";
import { setVocabulary } from "./i18n";
import { getPack } from "./packs";

// Browser-side demo store: one in-memory state, mirrored to localStorage.
// Pages read it with `useDemo()`; on the server it is `null`, so the studio
// renders a loading shell first and the real UI only in the browser.

const STORAGE_KEY = "salong-eko-demo";
const UNDO_LIMIT = 20;

let state: DemoState | null = null;
let history: DemoState[] = [];
const listeners = new Set<() => void>();

function today() {
  return toKey(new Date());
}

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = migrateState(JSON.parse(raw));
      if (saved && saved.generatedFor === today()) return purgeExpired(saved, today());
    }
  } catch {
    // Storage blocked or corrupt: fall back to fresh demo data.
  }
  return createDemoState(today());
}

function save(next: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The demo still works in memory.
  }
}

/** The words of the business's industry pack apply as soon as its state is current. */
function adopt(next: DemoState) {
  setVocabulary(getPack(next.pack).vocabulary);
  return next;
}

function setState(next: DemoState) {
  state = adopt(next);
  save(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DemoState | null {
  if (!state && typeof window !== "undefined") state = adopt(load());
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
  const current = getSnapshot();
  if (!current) return false;
  const now = Date.now();
  const next = applyAction(current, action, { ...defaultMeta(action, now), ...meta, at: now });
  if (next === current) return false;
  history = [...history.slice(-(UNDO_LIMIT - 1)), current];
  setState(next);
  return true;
}

export function undo() {
  const previous = history.pop();
  if (previous) setState(previous);
}

/** Rebuilds the demo for a business setup (industry pack, team size, modules). Without one it is the original Salong Eko. */
export function startBusiness(setup?: BusinessSetup) {
  history = [];
  setState(createDemoState(today(), setup));
}

export function useDemo(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
