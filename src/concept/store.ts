"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DemoAction } from "./actions";
import { toKey } from "./data/dates";
import { createDemoState, type BusinessSetup } from "./data/generate";
import { migrateState } from "./data/migrate";
import type { DemoState } from "./data/types";
import { demoMessageLedger, demoPaymentLedger, withDemoChannels } from "./connections/demo";
import { nextWaitlistWake } from "./booking/waitlist-match";
import { salonClock } from "./tools/clock";
import { visitTime } from "./booking/policy";
import { withOffersHeld } from "./booking/waitlist-offer";
import { DEFERRED_WRITE_FAILED } from "./support/deferred-write";
import { withRecordIds } from "./data/ids";
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
  /** Changes shown in this tab while their commit waits for the booking lock. */
  pending?: DemoState;
  queued?: number;
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
      // A queue still in use spans midnight: open times still ahead, offers still held, or a visitor's request with
      // days still ahead. Ended or expired offers, past gaps and older requests without days do not hold the sample back.
      const opened = Date.now();
      const liveQueue = saved.waitlistGaps.some(gap => visitTime({ date: gap.date, start: gap.end }).toMillis() > opened) ||
        saved.waitlistOffers.some(offer => offer.status === "offered" && offer.expiresAt > opened) ||
        saved.waitlistEntries.some(entry => !entry.id.startsWith("fixture-") && (entry.days.at(-1) ?? "") >= salonClock().today);
      const demo = saved.generatedFor === today() || liveQueue
        ? purge({ ...saved, generatedFor: today() })
        : { ...createDemoState(today(), setupOf(saved)), reminderSettings: saved.reminderSettings, waitlistRules: saved.waitlistRules };
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
  // Like every save, it holds the booking lock of the salon it writes, also when it was read while
  // another salon's lock is held (a storage event, or the other salon's address check).
  if (hasCrossTabLock() && !heldWorkspaces.has(workspace)) {
    void navigator.locks.request(storageKey(workspace), () => holding(workspace, () => persistErasure(workspace, raw, state))).catch(() => undefined);
    return;
  }
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
  scheduleWaitlist();
  listeners.forEach(listener => listener());
}

// The waiting list runs on the salon's clock while a studio or booking page is open: at the next
// deadline (a hold ends, quiet hours end, a day passes), on focus and on opening. With every tab
// closed nothing runs; the first page opened catches up.
let waitlistTimer: ReturnType<typeof setTimeout> | undefined;
const MAX_TIMER = 2_147_483_647;

/** After a tick that could not save (full storage), wait longer before trying the same deadline again. */
let retryDelay = 0;
const RETRY_MIN = 30_000;
const RETRY_MAX = 5 * 60_000;

function scheduleWaitlist(delay?: number) {
  clearTimeout(waitlistTimer);
  const state = snapshots[active].state;
  if (!listeners.size || !state) return;
  const wake = delay ?? nextWaitlistWake(state, Date.now()) - Date.now();
  if (Number.isFinite(wake)) waitlistTimer = setTimeout(tickWaitlist, Math.min(MAX_TIMER, Math.max(1, retryDelay, wake)));
}

function tickWaitlist() {
  if (!listeners.size) return;
  const settle = (changed: unknown) => {
    const state = snapshots[active].state;
    const overdue = !!state && nextWaitlistWake(state, Date.now()) <= Date.now();
    retryDelay = !changed && overdue ? Math.min(RETRY_MAX, Math.max(RETRY_MIN, retryDelay * 2)) : 0;
  };
  // A lock request that fails (an embedded page without Web Locks access) counts as a failed tick too.
  void withBookingLock(() => dispatch({ type: "waitlist/advance" }))
    .then(settle, () => settle(false))
    .finally(() => scheduleWaitlist());
}

/** Focus, another tab's write or a page opening is a reason to try again at once. */
function retryWaitlistNow() {
  retryDelay = 0;
  tickWaitlist();
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

/** False: another tab wrote first, try again. "unsaved": the change must be saved to count and could not be. */
function setState(next: DemoState, recheckStorage = false, afterWrite?: () => void, mustSave = false): boolean | "unsaved" {
  const snapshot = snapshots[active];
  try {
    const raw = JSON.stringify(next);
    if (recheckStorage && refreshFromStorage()) return false;
    window.localStorage.setItem(storageKey(active), raw);
    snapshot.raw = raw;
    snapshot.version = snapshot.lastWrite = { day: next.generatedFor, seq: next.seq };
  } catch {
    // A personal offer kept only in this tab could be claimed again in another one.
    if (mustSave) return "unsaved";
    // The demo still works in memory.
  }
  snapshot.state = next;
  afterWrite?.();
  notify();
  return true;
}

function subscribe(listener: () => void) {
  const first = !listeners.size;
  if (first) {
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", retryWaitlistNow);
  }
  listeners.add(listener);
  refreshFromStorage();
  if (first) {
    clearTimeout(waitlistTimer);
    waitlistTimer = setTimeout(tickWaitlist, 0);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", retryWaitlistNow);
      clearTimeout(waitlistTimer);
    }
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
  const snapshot = snapshots[active];
  // Inside the lock writes build on what is saved; everywhere else the page also shows changes still being committed.
  return (!insideBookingLock && snapshot.pending) || snapshot.state || null;
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

/**
 * Returns the new log entry ID, null for an unlogged change, or false on refusal.
 * A caller's guard runs against the same refreshed state as the action.
 *
 * Every save goes through the booking lock when the browser has Web Locks, so no two tabs ever write
 * their whole snapshot over each other. Called outside the lock, the change shows at once (the page
 * reads it from `currentState()` as before) and is committed under the lock right after, on the
 * latest saved copy. A commit that is then refused is reported by the toast layer and the page
 * returns to what was saved. Callers that must know the committed result await `dispatchCommitted`.
 */
export function dispatchWithLog(
  action: DemoAction,
  meta?: Partial<Omit<LogMeta, "at">>,
  canApply?: (current: DemoState) => boolean,
): string | null | false {
  initialize();
  if (!insideBookingLock && typeof window !== "undefined" && hasCrossTabLock()) return showThenCommit(action, meta, canApply);
  return commitNow(action, meta, canApply);
}

/** Operation ids: unique per tab and change, so the preview and its commit name the same entry. */
const TAB_ID = Math.random().toString(36).slice(2, 10);
let operations = 0;

/**
 * The change in this tab's view at once, then the real write under the lock. It returns the
 * operation id rather than the preview's entry id: another tab can commit an entry with that id
 * first, and Undo must never take back someone else's change.
 */
function showThenCommit(action: DemoAction, given: Partial<Omit<LogMeta, "at">> | undefined, canApply?: (current: DemoState) => boolean): string | null | false {
  const workspace = active;
  const meta = { ...given, op: `op-${TAB_ID}-${++operations}` };
  refreshFromStorage();
  const view = getSnapshot();
  if (!view || (canApply && !canApply(view))) return false;
  const now = Date.now();
  const logMeta = { ...defaultMeta(action, now), ...meta, at: now };
  // A preview only: nothing it would send or charge is published, and it sends no personal offer.
  // Records it creates get ids from the operation, so its commit creates the very same ids.
  const next = withRecordIds(meta.op, () => withOffersHeld(true, () => withDemoChannels(demoMessageLedger.stage(), () => prepareAction(view, action, logMeta, demoPaymentLedger.stage()))));
  if (next === view) return false;
  if (next.salon.slug !== view.salon.slug && next.salon.slug === workspaceSlug(workspace === "demo" ? "own" : "demo")) return false;
  const snapshot = snapshots[workspace];
  snapshot.pending = next;
  snapshot.queued = (snapshot.queued ?? 0) + 1;
  notify();
  void withBookingLock(() => commitNow(action, meta, canApply))
    .catch(() => false as const)
    .then((result) => {
      snapshot.queued = (snapshot.queued ?? 1) - 1;
      if (!snapshot.queued) snapshot.pending = undefined;
      notify();
      // The toast layer listens and reports it; the caller was already told it worked.
      if (result === false) window.dispatchEvent(new Event(DEFERRED_WRITE_FAILED));
    });
  return next.log[0]?.id !== view.log[0]?.id ? meta.op : null;
}

/** The write itself: inside the booking lock, or directly in a browser without Web Locks. */
function commitNow(action: DemoAction, meta: Partial<Omit<LogMeta, "at">> | undefined, canApply?: (current: DemoState) => boolean): string | null | false {
  const workspace = active;
  refreshFromStorage();
  const now = Date.now();
  const logMeta = { ...defaultMeta(action, now), ...meta, at: now };
  while (true) {
    const current = getSnapshot();
    if (!current || active !== workspace || (canApply && !canApply(current))) return false;
    // Booking a personal offer needs the real cross-tab lock: without it two tabs could both claim it.
    const personalBooking = action.type === "online/claim" || (action.type === "online/pay" && current.checkoutHolds.some(hold => hold.id === action.id && hold.offerId));
    if (personalBooking && !insideBookingLock) return false;
    const batch = demoPaymentLedger.stage();
    const messages = demoMessageLedger.stage();
    // Offers go out only under the booking lock; a browser without one sends none.
    const next = withRecordIds(meta?.op, () => withOffersHeld(!insideBookingLock, () => withDemoChannels(messages, () => prepareAction(current, action, logMeta, batch))));
    if (next === current) return false;
    // Includes undo, which can restore a previously free address.
    if (next.salon.slug !== current.salon.slug && next.salon.slug === workspaceSlug(active === "demo" ? "own" : "demo")) return false;
    // The save re-reads storage first and runs the rules again on a newer copy.
    // A personal offer must reach shared storage before its link is texted or used: another tab
    // would otherwise not know it, and could claim it again or hand the time to someone else.
    // A customer told "you have left the list", an owner told offers are paused and a customer told
    // their request is saved must find it so in every tab, too.
    const releasesOffer = action.type === "online/release" && current.checkoutHolds.some(hold => hold.id === action.id && hold.offerId);
    const personalClaim = personalBooking || releasesOffer || action.type.startsWith("waitlist/") ||
      action.type === "online/leave" || action.type === "online/decline" || action.type === "online/waitlist" ||
      current.modules.waitlist !== next.modules.waitlist ||
      // The owner's approval to offer a freed time (also given while cancelling) is a queue decision too.
      next.waitlistGaps.some(gap => gap.approved && !current.waitlistGaps.some(old => old.id === gap.id && old.approved));
    const sendsOffer = next.waitlistOffers.some(offer => offer.status === "offered" && !current.waitlistOffers.some(old => old.id === offer.id));
    const saved = setState(next, true, () => { batch.publish(); messages.publish(); }, personalClaim || sendsOffer);
    if (saved === "unsaved") return false;
    if (!saved) continue;
    if (workspace === "own") markTrialUsed(now);
    const logId = next.log[0]?.id;
    return logId !== current.log[0]?.id ? logId ?? null : null;
  }
}

export type CommitResult = { ok: false } | { ok: true; state: DemoState; logId: string | null };

/**
 * Applies an action under the booking lock and resolves with what was committed: the saved state
 * and the log entry. For callers that show or open what the change created (a sold gift card's code,
 * a new campaign) or confirm success to a customer.
 */
export function dispatchCommitted(action: DemoAction, meta?: Partial<Omit<LogMeta, "at">>, canApply?: (current: DemoState) => boolean): Promise<CommitResult> {
  return withBookingLock((): CommitResult => {
    const logId = dispatchWithLog(action, meta, canApply);
    const state = snapshots[active].state;
    return logId === false || !state ? { ok: false } : { ok: true, state, logId };
  }).then((result) => result || { ok: false as const }, () => ({ ok: false as const }));
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

/** True while a booking-lock callback runs in this tab under Web Locks, which serialize it with every other tab. */
let insideBookingLock = false;

/**
 * Whether this browser can serialize booking writes across tabs. Without it the
 * demo never sends or books personal offers: it fails closed instead of racing.
 */
export function hasCrossTabLock(): boolean {
  return typeof navigator !== "undefined" && !!navigator.locks;
}

/** The salons whose booking lock this tab holds right now. */
const heldWorkspaces = new Set<Workspace>();

function holding<T>(workspace: Workspace, run: () => T): T {
  const had = heldWorkspaces.has(workspace);
  heldWorkspaces.add(workspace);
  try {
    return run();
  } finally {
    if (!had) heldWorkspaces.delete(workspace);
  }
}

function runLocked<T>(workspace: Workspace, write: (required?: BookingReceipt) => T, required?: BookingReceipt): T {
  const previous = insideBookingLock;
  insideBookingLock = true;
  try {
    return holding(workspace, () => write(required));
  } finally {
    insideBookingLock = previous;
  }
}

async function withBookingReceipt<T>(write: (required?: BookingReceipt) => T, reset = false): Promise<T | false> {
  initialize();
  const workspace = active;
  const snapshot = snapshots[workspace];
  // No cross-tab lock: run the write as before, but not as "locked", so no personal offer is sent or booked.
  if (typeof window === "undefined" || !hasCrossTabLock()) return write();
  return navigator.locks.request(storageKey(workspace), async () => {
    const receipts = await bookingReceipts();
    if (workspace !== active) return false;
    if (!receipts) return runLocked(workspace, write);
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
    const result = runLocked(workspace, write, required);
    if (snapshot.lastWrite && snapshot.lastWrite !== before) {
      // A storage quota error must not hide an appointment already saved.
      await receipts.put(receiptKey, Response.json(snapshot.lastWrite)).catch(() => undefined);
    }
    return result;
  });
}

/**
 * Applies an action under the booking lock and resolves once it is saved (true) or refused (false).
 * For callers that confirm success to a customer: a plain `dispatch` outside the lock may only queue the change.
 */
export function dispatchConfirmed(action: DemoAction, meta?: Partial<Omit<LogMeta, "at">>): Promise<boolean> {
  return dispatchCommitted(action, meta).then((result) => result.ok);
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
