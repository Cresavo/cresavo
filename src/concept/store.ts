"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DemoAction } from "./actions";
import { toKey } from "./data/dates";
import { createDemoState, type BusinessSetup } from "./data/generate";
import { migrateState } from "./data/migrate";
import type { DemoState } from "./data/types";
import { forgetDemoSends, stageDemoSends, withDemoChannels } from "./connections/demo";
import type { OutboxEntry } from "./connections/simulated/outbox";
import { prepareAction, defaultMeta } from "./log/capture";
import type { LogMeta } from "./log/types";
import { publicView } from "./selectors";
import { purgeExpired } from "./trash/trash";
import { getActiveLocale, setVocabulary } from "./i18n";
import { salonCopy } from "./i18n/salon-eko-copy";
import { checkNewSlug, createSalon, suggestedSlug, type SalonDraft } from "./onboarding/salon";
import { setupOf } from "./onboarding/setup";
import { parseLastUse, trialExpired } from "./onboarding/trial";
import { getPack } from "./packs";

// Browser-side demo store: each workspace has its own shared snapshot.
// Pages read it with `useDemo()`; on the server it is `null`, so the studio
// renders a loading shell first and the real UI only in the browser.

const STORAGE_KEY = "salong-eko-demo";
interface BookingReceipt { day: string; seq: number }
export type Workspace = "demo" | "own";
interface WorkspaceSnapshot {
  state?: DemoState | null;
  raw?: string | null;
  version?: BookingReceipt;
  lastWrite?: BookingReceipt;
}
const snapshots: Record<Workspace, WorkspaceSnapshot> = { demo: {}, own: {} };
const SELECTION_KEY = "salong-eko-workspace";
let primary: Workspace | undefined;
let active: Workspace = "demo";
/** Set when an idle trial salon was removed on opening, until the owner has seen the notice. */
let trialRemoved = false;

// Older versions put the selected salon at STORAGE_KEY. Keep that snapshot in
// place, even when quota would prevent copying it to a new key.
function initialize() {
  if (primary || typeof window === "undefined") return;
  primary = "demo";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && JSON.parse(raw)?.industry) primary = "own";
  } catch { /* Fresh demo or unavailable storage. */ }
  active = primary;
  try {
    const selection = window.sessionStorage.getItem(SELECTION_KEY);
    if (selection === "own" || selection === "demo") active = selection;
  } catch { /* The selection still lasts for this tab. */ }
  expireIdleTrial(Date.now(), false);
}

function storageKey(workspace: Workspace) {
  return workspace === primary ? STORAGE_KEY : `${STORAGE_KEY}-${workspace}`;
}
const listeners = new Set<() => void>();
const removalListeners = new Set<(workspace: Workspace) => void>();

/** Tells `BrowserStudioStore` that a workspace's salon was deleted or replaced, so its records for it end. */
function salonRemoved(workspace: Workspace) {
  forgetDemoSends(workspace);
  removalListeners.forEach(listener => listener(workspace));
}

/** Called when a workspace's salon is deleted (trial expiry, "Delete now", another tab) or replaced (a new sample business). */
export function onSalonRemoved(listener: (workspace: Workspace) => void): () => void {
  removalListeners.add(listener);
  return () => { removalListeners.delete(listener); };
}

// The own salon's last use is kept beside its snapshot, so reading it never touches the salon itself.
const lastUseKey = () => `${storageKey("own")}-last-used`;

function removeOwnSalon(announce: boolean) {
  try {
    window.localStorage.removeItem(storageKey("own"));
    window.localStorage.removeItem(lastUseKey());
  } catch { /* Nothing more to remove. */ }
  snapshots.own = {};
  salonRemoved("own");
  if (active === "own") {
    active = "demo";
    try { window.sessionStorage.setItem(SELECTION_KEY, "demo"); }
    catch { /* Keep the selection in memory. */ }
  }
  if (announce) notify();
}

/**
 * Removes the trial salon when it has gone unused for 24 hours and reports whether it did.
 * A salon without a record (made before this rule) starts counting now. `now` is injectable for tests.
 */
export function expireIdleTrial(now = Date.now(), announce = true): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!window.localStorage.getItem(storageKey("own"))) return false;
    const lastUse = parseLastUse(window.localStorage.getItem(lastUseKey()));
    if (!trialExpired(lastUse, now)) {
      if (lastUse === null) window.localStorage.setItem(lastUseKey(), String(now));
      return false;
    }
  } catch {
    return false;
  }
  removeOwnSalon(false);
  trialRemoved = true;
  if (announce) notify();
  return true;
}

/** Records that the trial salon is in use (opened or changed). The demo salon has no record. */
export function markTrialUsed(now = Date.now()) {
  if (typeof window === "undefined") return;
  initialize();
  if (active !== "own" || !snapshots.own.state) return;
  try { window.localStorage.setItem(lastUseKey(), String(now)); }
  catch { /* The salon then expires a day after its last recorded use. */ }
}

/** "Delete now": removes the trial salon from this browser and returns to the demo salon. */
export function deleteTrialSalon() {
  initialize();
  removeOwnSalon(true);
}

export function useTrialRemoved(): boolean {
  return useSyncExternalStore(subscribe, () => { initialize(); return trialRemoved; }, () => false);
}

export function dismissTrialRemoved() {
  trialRemoved = false;
  notify();
}

function today() {
  return toKey(new Date());
}

/** Set by `load` when a customer's 30 days in the trash were over and `purgeExpired` erased them. */
let erasedOnLoad = false;

const customerBundles = (state: DemoState) => state.trash.filter((entry) => entry.kind === "customer").length;

function purge(state: DemoState): DemoState {
  const next = purgeExpired(state, today());
  if (customerBundles(next) < customerBundles(state)) erasedOnLoad = true;
  return next;
}

function load(raw: string | null, workspace: Workspace): DemoState | null {
  try {
    let saved = raw && migrateState(JSON.parse(raw));
    if (saved && Boolean(saved.industry) === (workspace === "own")) {
      const validHolds = saved.checkoutHolds.filter(hold => hold.expiresAt > Date.now());
      if (validHolds.length !== saved.checkoutHolds.length) saved = { ...saved, checkoutHolds: validHolds };
      if (saved.industry) return purge({ ...saved, generatedFor: today() });
      const demo = saved.generatedFor === today()
        ? purge(saved)
        : { ...createDemoState(today(), setupOf(saved)), reminderSettings: saved.reminderSettings };
      // An older setup could give both salons the same address. Keep the
      // published local link and restore the demo's fixture address in that case.
      const fixtureSlug = getPack(demo.pack).salon.slug;
      const conflict = saved.salon.slug !== fixtureSlug && saved.salon.slug === workspaceSlug("own");
      return { ...demo, salon: { ...demo.salon, slug: conflict ? fixtureSlug : saved.salon.slug } };
    }
  } catch {
    // A corrupt snapshot falls back to fresh demo data.
  }
  return workspace === "demo" ? createDemoState(today()) : null;
}

function refresh(workspace: Workspace) {
  const snapshot = snapshots[workspace];
  let raw = snapshot.raw ?? null;
  try { raw = window.localStorage.getItem(storageKey(workspace)); }
  catch { /* Use the snapshot in memory. */ }
  if (raw === snapshot.raw) return false;
  snapshot.raw = raw;
  const had = !!snapshot.state;
  erasedOnLoad = false;
  snapshot.state = load(raw, workspace);
  if (erasedOnLoad && snapshot.state) persistErasure(workspace, raw, snapshot.state);
  if (had && !snapshot.state) salonRemoved(workspace);
  snapshot.version = raw && snapshot.state ? { day: snapshot.state.generatedFor, seq: snapshot.state.seq } : undefined;
  return true;
}

/**
 * Writes back a load that erased an expired customer, so the saved text no
 * longer holds them either. Only over the text just read: if another tab wrote
 * meanwhile, its snapshot wins and is purged when this tab reads it.
 */
function persistErasure(workspace: Workspace, raw: string | null, state: DemoState) {
  const snapshot = snapshots[workspace];
  try {
    if (window.localStorage.getItem(storageKey(workspace)) !== raw) return;
    const text = JSON.stringify(state);
    window.localStorage.setItem(storageKey(workspace), text);
    snapshot.raw = text;
  } catch {
    // Storage unavailable: the next load erases again.
  }
}

function notify() {
  const state = snapshots[active].state;
  if (state) setVocabulary(getPack(state.pack).vocabulary);
  listeners.forEach(listener => listener());
}

function refreshFromStorage() {
  if (typeof window === "undefined") return false;
  initialize();
  const changed = refresh(active);
  if (changed) notify();
  return changed;
}

function onStorage(event: StorageEvent) {
  if (event.storageArea !== window.localStorage) return;
  const workspaces = (["demo", "own"] as const).filter(workspace => event.key === null || event.key === storageKey(workspace));
  if (!workspaces.length) return;
  workspaces.forEach(refresh);
  notify();
}

function setState(next: DemoState, recheckStorage = false, afterWrite?: () => void): boolean {
  const snapshot = snapshots[active];
  try {
    const raw = JSON.stringify(next);
    if (recheckStorage && refreshFromStorage()) return false;
    window.localStorage.setItem(storageKey(active), raw);
    snapshot.raw = raw;
    snapshot.version = snapshot.lastWrite = { day: next.generatedFor, seq: next.seq };
  } catch {
    // The demo still works in memory.
  }
  snapshot.state = next;
  afterWrite?.();
  notify();
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
  if (typeof window === "undefined") return snapshots[active].state ?? null;
  initialize();
  if (!snapshots[active].state) {
    refresh(active);
    if (!snapshots[active].state) {
      active = "demo";
      refresh(active);
    }
    const state = snapshots[active].state;
    if (state) setVocabulary(getPack(state.pack).vocabulary);
  }
  return snapshots[active].state ?? null;
}

/** The current state outside React, for code that just dispatched and needs the result. */
export function currentState(): DemoState | null {
  return getSnapshot();
}

/** Like `currentState`, after first picking up another tab's write. Used by `BrowserStudioStore`. */
export function latestState(): DemoState | null {
  refreshFromStorage();
  return getSnapshot();
}

/** The saved text behind the current state as last read or written, for freshness checks. */
export function currentRaw(): string | null {
  return snapshots[active].raw ?? null;
}

/** The store's own change notifications (writes here, other tabs, workspace switches), outside React. */
export function subscribeStore(listener: () => void): () => void {
  return subscribe(listener);
}

/**
 * Applies an action and records it in the activity log. `meta` says who and
 * where it came from when that is not "the owner pressed a button".
 * Returns false when nothing changed (e.g. the slot was taken).
 */
export function dispatch(action: DemoAction, meta?: Partial<Omit<LogMeta, "at">>): boolean {
  return dispatchWithLog(action, meta) !== false;
}

/** More for a change than its action: sends that belong to it, staged and published with it. */
export interface DispatchOptions {
  /**
   * Simulated sends that belong to the change but not to its reducer (an offer
   * text to the waiting list). Runs on the state the action is applied to,
   * staged like the reducer's own sends; false refuses the whole change.
   */
  send?: (current: DemoState) => boolean;
  /** Called after a successful save with the sends its destinations accepted (a repeated id is not a new send). */
  committed?: (sent: OutboxEntry[]) => void;
}

/**
 * Returns the new log entry ID, null for an unlogged change, or false on refusal.
 * A caller's guard runs against the same refreshed state as the action. The
 * action can be built from that state, so what it records (counts, names)
 * matches what is saved and sent; it is built again if the save is retried.
 * Everything the change sends (payments, SMS, email, posts) is staged and
 * reaches the outbox only after the save; a refused or discarded attempt sends nothing.
 */
export function dispatchWithLog(
  build: DemoAction | ((current: DemoState) => DemoAction),
  meta?: Partial<Omit<LogMeta, "at">>,
  canApply?: (current: DemoState) => boolean,
  options: DispatchOptions = {},
): string | null | false {
  initialize();
  const workspace = active;
  refreshFromStorage();
  const now = Date.now();
  while (true) {
    const current = getSnapshot();
    if (!current || active !== workspace || (canApply && !canApply(current))) return false;
    const action = typeof build === "function" ? build(current) : build;
    const logMeta = { ...defaultMeta(action, now), ...meta, at: now };
    const batch = stageDemoSends(workspace);
    const next = withDemoChannels(batch, () => {
      const prepared = prepareAction(current, action, logMeta, batch);
      return prepared !== current && options.send && !options.send(current) ? current : prepared;
    });
    if (next === current) return false;
    // Includes undo, which can restore a previously free address.
    if (next.salon.slug !== current.salon.slug && next.salon.slug === workspaceSlug(active === "demo" ? "own" : "demo")) return false;
    // Run the booking rules again if another tab wrote while we prepared the save.
    const recheck = !!canApply || action.type.startsWith("online/") || action.type === "salon/policy" ||
      action.type === "booking/fee" || action.type === "booking/cancel" || action.type === "trash/restore";
    let published: OutboxEntry[] = [];
    if (!setState(next, recheck, () => { published = batch.publish(); })) continue;
    options.committed?.(published);
    if (workspace === "own") markTrialUsed(now);
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
  initialize();
  const workspace = active;
  const snapshot = snapshots[workspace];
  if (typeof window === "undefined" || !navigator.locks) return write();
  return navigator.locks.request(storageKey(workspace), async () => {
    const receipts = await bookingReceipts();
    if (workspace !== active) return false;
    if (!receipts) return write();
    const receiptKey = new URL(workspace === primary ? "/concept-booking-sequence" : `/concept-booking-sequence-${workspace}`, window.location.origin).href;
    const receipt = await receipts.match(receiptKey).catch(() => undefined);
    const latest: BookingReceipt | undefined = await receipt?.json().catch(() => undefined);
    const required = latest?.day === today() ? latest : undefined;
    if (required && !reset) {
      // A missing snapshot can still be an older renderer's view of storage.
      for (let attempt = 0; ; attempt++) {
        if (workspace !== active) return false;
        refreshFromStorage();
        if (snapshot.version?.day === required.day && snapshot.version.seq >= required.seq) break;
        if (attempt === 40) return false;
        await new Promise(resolve => window.setTimeout(resolve, 25));
      }
    }
    if (workspace !== active) return false;
    const before = snapshot.lastWrite;
    const result = write(required);
    if (snapshot.lastWrite && snapshot.lastWrite !== before) {
      // A storage quota error must not hide an appointment already saved.
      await receipts.put(receiptKey, Response.json(snapshot.lastWrite)).catch(() => undefined);
    }
    return result;
  });
}

export function withBookingLock<T>(confirm: () => T): Promise<T | false> {
  return withBookingReceipt(confirm);
}

function workspaceSlug(workspace: Workspace) {
  initialize();
  refresh(workspace);
  return snapshots[workspace].state?.salon.slug;
}

export function useWorkspaceSlug(workspace: Workspace) {
  return useSyncExternalStore(subscribe, () => workspaceSlug(workspace), () => undefined);
}

function select(workspace: Workspace) {
  active = workspace;
  try { window.sessionStorage.setItem(SELECTION_KEY, workspace); }
  catch { /* Keep the selection in memory. */ }
  markTrialUsed();
  notify();
}

/** The existing sample-business chooser and explicit demo reset. */
export async function startBusiness(setup?: BusinessSetup): Promise<void> {
  initialize();
  if (active !== "demo") select("demo");
  await withBookingReceipt(required => {
    refreshFromStorage();
    const next = createDemoState(today(), setup);
    next.seq = Math.max(next.seq, (snapshots.demo.state?.seq ?? 0) + 1, (required?.seq ?? 0) + 1);
    salonRemoved("demo");
    return setState(next);
  }, true);
}

/** Serialize address allocation across setup and the address editor in both workspaces. */
export function withAddressLock<T>(change: () => T): Promise<T | false> {
  initialize();
  const workspace = active;
  if (!navigator.locks) return Promise.resolve(change());
  return navigator.locks.request("concept-salon-address", () => workspace === active ? change() : false);
}

export async function switchSalon(to: Workspace, draft?: SalonDraft) {
  initialize();
  if (to === "own" && !draft && expireIdleTrial()) return false;
  const open = () => {
    refresh(to);
    if (snapshots[to].state && draft) return false;
    if (!snapshots[to].state) {
      if (to !== "own" || !draft) return false;
      if (!checkNewSlug(draft.slug || suggestedSlug(draft), workspaceSlug("demo")).ok) return false;
      const now = new Date();
      const next = createSalon(today(), draft, { examplesAfter: now.getHours() * 60 + now.getMinutes() });
      const raw = JSON.stringify(next);
      try { window.localStorage.setItem(storageKey(to), raw); }
      catch { return false; }
      snapshots[to] = { raw, state: next, version: { day: next.generatedFor, seq: next.seq } };
    }
    select(to);
    return true;
  };
  return draft ? withAddressLock(open) : open();
}

/** The booking URL selects its workspace only in the tab opening the link. */
export function openBookingWorkspace(slug: string) {
  if (getSnapshot()?.salon.slug === slug) return;
  const other = active === "demo" ? "own" : "demo";
  if (workspaceSlug(other) === slug) select(other);
}

export function useDemo(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** The state for the booking pages: what customers may see and book (hidden treatments are not on offer). */
export function usePublicDemo(): DemoState | null {
  const state = useDemo();
  const language = getActiveLocale();
  return useMemo(() => state && salonCopy(publicView(state), language), [state, language]);
}
