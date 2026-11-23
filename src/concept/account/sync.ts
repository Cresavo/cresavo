"use client";

import type { DemoAction } from "../actions";
import type { DemoState, JournalEntry } from "../data/types";
import { t, type MessageKey } from "../i18n";
import { closeAccountSalon, currentTarget, onAccountChange, openAccountSalon, replaceAccountSalon, restoreAccountBase, restoreAccountSalon, type AccountChange } from "../store";
import type { CommitFailure } from "../store/browser-studio-store";
import { showToast } from "../ui/toast";
import { UPLOAD_SESSION_HEADER } from "@/lib/media/limits";
import { ownerHintPresent } from "./hint";
import { onSessionSignal } from "./session-signal";

// Keeps a signed-in owner's salon in step with the server. Changes show at
// once in the studio and are sent one at a time; the server runs the same
// rules again and its answer replaces the shown salon. When the server
// refuses a change, the salon is read again and the owner is told. A caller
// that must know the outcome of one change waits for its answer by request id.

const SALON = "/api/owner/salon";
/** Journal reads and writes while the server keeps journals (JOURNALS_ON_SERVER). */
const JOURNALS = "/api/owner/journals";
/** Refusals the owner can act on, by the code the server sent. */
const REFUSAL_TEXT: Record<string, MessageKey> = {
  slug_taken: "address.slug.taken", logo_inline: "photos.error.logoInline", logo_unknown: "photos.error.logoUnknown", journals_unavailable: "journal.unavailable",
};
/** Set by the salon load: the server keeps this salon's journal text and hands it out one customer at a time. */
let journalsServer = false;

/** The session the shown salon was loaded in: journal requests carry it, and the server refuses another session's. */
let salonSession: string | null = null;
/** Bumped whenever the session changes, so journal text read for an earlier session is never shown. */
let sessionEpoch = 0;

/** True when the salon shown is a signed-in salon whose journals are read from the server, one customer at a time. */
export const journalsOnServer = () => journalsServer && currentTarget()?.workspace === "account";

/** What journal text read from the server belongs to: the session it was read in. Changes on every account change. */
export const journalSessionKey = () => `${sessionEpoch}:${salonSession ?? ""}`;

const sessionListeners = new Set<() => void>();

/** Calls `listener` whenever journal text read before may no longer be shown (the login or the open salon changed). */
export function onJournalSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function newEpoch() {
  sessionEpoch++;
  sessionListeners.forEach((listener) => listener());
}

function bindSession(session: string | null) {
  if (session === salonSession) return;
  salonSession = session;
  newEpoch();
}

/** Signed out or switched away: nothing read or queued for the old session is used any more. */
function closeSalon() {
  bindSession(null);
  closeAccountSalon();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  // This tab opened or closed an account salon: journal text read before is not shown again.
  onAccountChange(newEpoch);
  // Another tab signed in, out or switched accounts: drop what was read, and send nothing more under the old login
  // until this tab loads its salon again (the server refuses it, and the studio reloads).
  onSessionSignal(() => bindSession(null));
}
let queue: Promise<void> = Promise.resolve();
let pending = 0;

/** How long one request to the server may take before it counts as unreachable. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** The server's answer for one change: the salon right after it, or why it was not saved. */
export type Answer =
  | { ok: true; state: DemoState; version: number; replayed: boolean }
  | { ok: false; reason: CommitFailure };

const waiters = new Map<string, (answer: Answer) => void>();

/** The newest salon the server answered with since the queue was last empty, and whether the screen already shows a server copy at least as new. */
let latestAnswer: DemoState | null = null;
let reconciled = true;

// The log entry the server made for a change, by request id: the id the change was shown with here is provisional.
const answeredLogs = new Map<string, Promise<string | null>>();
const logSettlers = new Map<string, (id: string | null) => void>();

/** Resolves with the server's log id for the change sent under this request id, or null when it logged none or was refused. */
export function serverLogId(requestId: string): Promise<string | null> {
  return answeredLogs.get(requestId) ?? Promise.resolve(null);
}

function expectLog(requestId: string) {
  if (answeredLogs.size > 200) {
    const oldest = answeredLogs.keys().next().value!;
    answeredLogs.delete(oldest);
    logSettlers.delete(oldest);
  }
  answeredLogs.set(requestId, new Promise((resolve) => { logSettlers.set(requestId, resolve); }));
}

export const newRequestId = () => crypto.randomUUID().replaceAll("-", "");

/**
 * Resolves with the server's answer for the change sent under this request id (its idempotency key). Call it
 * before dispatching the change, and `cancel` when nothing was sent after all. Null when a change under the
 * same id is still waiting for its answer: an id is never shared by two waiters.
 */
export function expectAnswer(requestId: string) {
  if (waiters.has(requestId)) return null;
  let settle!: (answer: Answer) => void;
  const answer = new Promise<Answer>((resolve) => { settle = resolve; });
  waiters.set(requestId, settle);
  return { answer, cancel: () => { waiters.delete(requestId); } };
}

const REFUSALS: Record<number, CommitFailure> = { 404: "not-found", 409: "conflict", 422: "rejected" };

/** One request, abandoned after `REQUEST_TIMEOUT_MS`; the body is read within that time. */
async function request(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { status: response.status, ok: response.ok, body: await response.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

async function post(action: DemoAction, idempotencyKey: string, session: string | null) {
  const journal = journalsServer && (action.type === "journal/add" || action.type === "journal/edit");
  // Every change goes out bound to the login it was made in, retries included: never to another account or sign-in.
  const headers: Record<string, string> = { "content-type": "application/json", [UPLOAD_SESSION_HEADER]: session ?? "" };
  const send = () => request(journal ? JOURNALS : `${SALON}/actions`, { method: "POST", headers, body: JSON.stringify({ action, idempotencyKey }) });
  try {
    return await send();
  } catch {
    // One retry with the same key: the server replays a change it already saved.
    return send();
  }
}

async function readSalon(): Promise<{ state: DemoState } | null> {
  const response = await request(SALON, { cache: "no-store" });
  if (response.ok) {
    journalsServer = response.body?.journals === "server";
    bindSession(typeof response.body?.session === "string" ? response.body.session : null);
  }
  return response.ok ? response.body : null;
}

/**
 * One customer's journal entries with their text, read (and logged) by the server for the session the salon was
 * loaded in; null when they could not be read, or when the session changed while the request was out.
 */
export async function readCustomerJournals(customerId: string): Promise<JournalEntry[] | null> {
  if (!journalsOnServer() || !salonSession) return null;
  const bound = journalSessionKey();
  try {
    const response = await request(`${JOURNALS}?customer=${encodeURIComponent(customerId)}`, { cache: "no-store", headers: { [UPLOAD_SESSION_HEADER]: salonSession ?? "" } });
    if (bound !== journalSessionKey() || !journalsOnServer()) return null;
    if (response.status === 401) {
      closeSalon();
      showToast(t("account.sync.signedOut"));
      return null;
    }
    return response.ok && Array.isArray(response.body?.entries) ? response.body.entries : null;
  } catch {
    return null;
  }
}

/** Shows the server's copy again. When it cannot be read, the change that was not saved is taken off the screen if nothing newer is shown. */
async function reload(change: AccountChange) {
  const salon = await readSalon().catch(() => null);
  if (salon) { replaceAccountSalon(salon.state); latestAnswer = salon.state; reconciled = true; }
  else restoreAccountSalon(change);
}

function send(action: DemoAction, change: AccountChange) {
  const idempotencyKey = change.requestId ?? newRequestId();
  const session = salonSession;
  if (pending === 0) { latestAnswer = null; reconciled = false; }
  pending++;
  expectLog(idempotencyKey);
  queue = queue.then(async () => {
    let answer: Answer = { ok: false, reason: "unavailable" };
    try {
      const response = await post(action, idempotencyKey, session);
      // An answer for another login (an account switch or a new sign-in meanwhile) is never shown here.
      if (salonSession !== session || (response.ok && typeof response.body?.session === "string" && response.body.session !== session)) {
        answer = { ok: false, reason: "conflict" };
        return;
      }
      if (response.status === 401) {
        closeSalon();
        showToast(t("account.sync.signedOut"));
        return;
      }
      const body = response.body;
      if (response.ok && body?.state) {
        answer = { ok: true, state: body.state, version: body.version, replayed: !!body.replayed };
        // Later changes are already shown; the last answer brings the salon in step.
        latestAnswer = body.state;
        reconciled = false;
        logSettlers.get(idempotencyKey)?.(body.state.log[0]?.id ?? null);
        if (pending === 1) { replaceAccountSalon(body.state); reconciled = true; }
        return;
      }
      answer = { ok: false, reason: body?.error === "idempotency-mismatch" ? "idempotency-mismatch" : REFUSALS[response.status] ?? "rejected" };
      await reload(change);
      showToast(t(REFUSAL_TEXT[String(body?.error)] ?? "account.sync.refused"));
    } catch {
      await reload(change);
      showToast(t("account.sync.offline"));
    } finally {
      pending--;
      logSettlers.get(idempotencyKey)?.(null);
      logSettlers.delete(idempotencyKey);
      // A last change that failed leaves the screen on an earlier optimistic state: the newest server copy replaces it.
      // With no server copy at all, the salon as it was confirmed before the queue is the only state that is true.
      if (pending === 0 && !reconciled && salonSession === session) { if (latestAnswer) replaceAccountSalon(latestAnswer); else restoreAccountBase(); reconciled = true; }
      waiters.get(idempotencyKey)?.(answer);
      waiters.delete(idempotencyKey);
    }
  });
}

/** What an erasure could not finish at once: payments still being processed keep their record, and a message that was being sent is not retried. */
export interface ErasureReport {
  pendingPayments: number;
  inFlightMessages: number;
}

/**
 * Erases one customer of the signed-in owner's salon for good. It waits for the changes already sent, and the
 * server redacts the customer's data in the audit log, the message outbox and the stored replay results as well
 * (`customer/erase` is not accepted as a plain change). Null when nothing could be confirmed: erasing again is safe.
 */
export function eraseAccountCustomer(customerId: string, name: string): Promise<ErasureReport | null> {
  // Bound to the login the owner asked in: the server refuses it for any other session, also after a switch meanwhile.
  const session = salonSession ?? "";
  const run = queue.then(async (): Promise<ErasureReport | null> => {
    try {
      const response = await request(`${SALON}/erase`, {
        method: "POST", headers: { "content-type": "application/json", [UPLOAD_SESSION_HEADER]: session }, body: JSON.stringify({ customerId, name }),
      });
      if (response.status === 401) {
        closeSalon();
        showToast(t("account.sync.signedOut"));
        return null;
      }
      if (!response.ok || !response.body?.state) return null;
      replaceAccountSalon(response.body.state);
      return { pendingPayments: Number(response.body.pendingPayments) || 0, inFlightMessages: Number(response.body.inFlightMessages) || 0 };
    } catch {
      return null;
    }
  });
  queue = run.then(() => undefined);
  return run;
}

/** Opens the signed-in owner's salon in the studio, if this browser has one. Returns true when it did. */
export async function openSignedInSalon(): Promise<boolean> {
  if (!ownerHintPresent(document.cookie)) return false;
  const salon = await readSalon().catch(() => null);
  return !!salon && openAccountSalon(salon.state, send);
}
