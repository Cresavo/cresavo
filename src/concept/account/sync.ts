"use client";

import type { DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { closeAccountSalon, openAccountSalon, replaceAccountSalon, restoreAccountSalon, type AccountChange } from "../store";
import type { CommitFailure } from "../store/browser-studio-store";
import { showToast } from "../ui/toast";
import { ownerHintPresent } from "./hint";

// Keeps a signed-in owner's salon in step with the server. Changes show at
// once in the studio and are sent one at a time; the server runs the same
// rules again and its answer replaces the shown salon. When the server
// refuses a change, the salon is read again and the owner is told. A caller
// that must know the outcome of one change waits for its answer by request id.

const SALON = "/api/owner/salon";
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

async function post(action: DemoAction, idempotencyKey: string) {
  const send = () => request(`${SALON}/actions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, idempotencyKey }),
  });
  try {
    return await send();
  } catch {
    // One retry with the same key: the server replays a change it already saved.
    return send();
  }
}

async function readSalon(): Promise<{ state: DemoState } | null> {
  const response = await request(SALON, { cache: "no-store" });
  return response.ok ? response.body : null;
}

/** Shows the server's copy again. When it cannot be read, the change that was not saved is taken off the screen if nothing newer is shown. */
async function reload(change: AccountChange) {
  const salon = await readSalon().catch(() => null);
  if (salon) { replaceAccountSalon(salon.state); reconciled = true; }
  else restoreAccountSalon(change);
}

function send(action: DemoAction, change: AccountChange) {
  const idempotencyKey = change.requestId ?? newRequestId();
  if (pending === 0) { latestAnswer = null; reconciled = false; }
  pending++;
  expectLog(idempotencyKey);
  queue = queue.then(async () => {
    let answer: Answer = { ok: false, reason: "unavailable" };
    try {
      const response = await post(action, idempotencyKey);
      if (response.status === 401) {
        closeAccountSalon();
        showToast(t("account.sync.signedOut"));
        return;
      }
      const body = response.body;
      if (response.ok && body?.state) {
        answer = { ok: true, state: body.state, version: body.version, replayed: !!body.replayed };
        // Later changes are already shown; the last answer brings the salon in step.
        latestAnswer = body.state;
        logSettlers.get(idempotencyKey)?.(body.state.log[0]?.id ?? null);
        if (pending === 1) { replaceAccountSalon(body.state); reconciled = true; }
        return;
      }
      answer = { ok: false, reason: body?.error === "idempotency-mismatch" ? "idempotency-mismatch" : REFUSALS[response.status] ?? "rejected" };
      await reload(change);
      showToast(t(body?.error === "slug_taken" ? "address.slug.taken" : "account.sync.refused"));
    } catch {
      await reload(change);
      showToast(t("account.sync.offline"));
    } finally {
      pending--;
      logSettlers.get(idempotencyKey)?.(null);
      logSettlers.delete(idempotencyKey);
      // A last change that failed leaves the screen on an earlier optimistic state: the newest server copy replaces it.
      if (pending === 0 && !reconciled && latestAnswer) { replaceAccountSalon(latestAnswer); reconciled = true; }
      waiters.get(idempotencyKey)?.(answer);
      waiters.delete(idempotencyKey);
    }
  });
}

/** Opens the signed-in owner's salon in the studio, if this browser has one. Returns true when it did. */
export async function openSignedInSalon(): Promise<boolean> {
  if (!ownerHintPresent(document.cookie)) return false;
  const salon = await readSalon().catch(() => null);
  return !!salon && openAccountSalon(salon.state, send);
}
