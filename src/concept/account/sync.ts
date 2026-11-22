"use client";

import type { DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { closeAccountSalon, openAccountSalon, replaceAccountSalon } from "../store";
import { showToast } from "../ui/toast";
import { ownerHintPresent } from "./hint";

// Keeps a signed-in owner's salon in step with the server. Changes show at
// once in the studio and are sent one at a time; the server runs the same
// rules again and its answer replaces the shown salon. When the server
// refuses a change, the salon is read again and the owner is told.

const SALON = "/api/owner/salon";
let queue: Promise<void> = Promise.resolve();
let pending = 0;
const watchers = new Map<string, (accepted: boolean) => void>();

/**
 * Resolves with whether the server accepted the next change of this type that is sent. Call it before
 * dispatching the change, and `cancel` when the change was not made after all.
 */
export function expectAck(type: DemoAction["type"]) {
  let settle!: (accepted: boolean) => void;
  const result = new Promise<boolean>((resolve) => { settle = resolve; });
  watchers.set(type, settle);
  return { result, cancel: () => { if (watchers.get(type) === settle) watchers.delete(type); } };
}

const key = () => crypto.randomUUID().replaceAll("-", "");

async function post(action: DemoAction, idempotencyKey: string) {
  const request = () => fetch(`${SALON}/actions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, idempotencyKey }),
  });
  try {
    return await request();
  } catch {
    // One retry with the same key: the server replays a change it already saved.
    return request();
  }
}

async function readSalon(): Promise<{ state: DemoState } | null> {
  const response = await fetch(SALON, { cache: "no-store" });
  return response.ok ? response.json() : null;
}

async function reload() {
  const salon = await readSalon().catch(() => null);
  if (salon) replaceAccountSalon(salon.state);
}

function send(action: DemoAction) {
  const idempotencyKey = key();
  pending++;
  queue = queue.then(async () => {
    let accepted = false;
    try {
      const response = await post(action, idempotencyKey);
      if (response.status === 401) {
        closeAccountSalon();
        showToast(t("account.sync.signedOut"));
        return;
      }
      const body = await response.json().catch(() => null);
      if (response.ok && body?.state) {
        // Later changes are already shown; the last answer brings the salon in step.
        if (pending === 1) replaceAccountSalon(body.state);
        accepted = true;
        return;
      }
      await reload();
      showToast(t("account.sync.refused"));
    } catch {
      await reload();
      showToast(t("account.sync.offline"));
    } finally {
      pending--;
      watchers.get(action.type)?.(accepted);
      watchers.delete(action.type);
    }
  });
}

/** Opens the signed-in owner's salon in the studio, if this browser has one. Returns true when it did. */
export async function openSignedInSalon(): Promise<boolean> {
  if (!ownerHintPresent(document.cookie)) return false;
  const salon = await readSalon().catch(() => null);
  return !!salon && openAccountSalon(salon.state, send);
}
