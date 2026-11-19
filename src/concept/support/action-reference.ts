import { stableHash } from "../connections/core";
import { en } from "../i18n/en";
import type { MessageKey } from "../i18n";

const MAX_DIAGNOSTICS = 50;
const storagePrefix = (own: boolean) => `concept-action-failure:${own ? "own" : "demo"}:`;

interface ActionDiagnostic {
  reason: MessageKey;
  at: number;
}

/** Local demo actions have no server request ID. Use an opaque ID for the attempt. */
export function newActionRequestId(): string {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(values, value => value.toString(16).padStart(8, "0")).join("");
}

export function actionReference(requestId: string): string {
  return `CR-${stableHash(requestId).toUpperCase()}`;
}

/** Keep only the dictionary key and time. Message substitutions can contain contact details. */
export function recordActionFailure(own: boolean, requestId: string, reason: MessageKey): void {
  try {
    const storage = window.localStorage;
    const prefix = storagePrefix(own);
    const key = prefix + actionReference(requestId);
    const previous = readDiagnostic(storage.getItem(key));
    if (previous?.reason === reason) return;
    storage.setItem(key, JSON.stringify({ reason, at: Date.now() } satisfies ActionDiagnostic));
    const older = Object.keys(storage).filter(entry => entry.startsWith(prefix) && entry !== key);
    if (older.length >= MAX_DIAGNOSTICS) {
      older.map(entry => ({ entry, at: readDiagnostic(storage.getItem(entry))?.at ?? 0 }))
        .sort((a, b) => b.at - a.at).slice(MAX_DIAGNOSTICS - 1)
        .forEach(({ entry }) => storage.removeItem(entry));
    }
  } catch { /* Browser storage may be unavailable. */ }
}

function readDiagnostic(raw: string | null): ActionDiagnostic | undefined {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (value && Object.hasOwn(en.messages, value.reason) && Number.isFinite(value.at)) {
      return { reason: value.reason, at: value.at };
    }
  } catch { /* Ignore a corrupt record. */ }
}

export function findActionFailure(own: boolean, input: string): ActionDiagnostic | undefined {
  const reference = input.trim().toUpperCase();
  if (!/^CR-[A-Z0-9]{7}$/.test(reference)) return;
  try {
    return readDiagnostic(window.localStorage.getItem(storagePrefix(own) + reference));
  } catch { /* Browser storage may be unavailable. */ }
}

export function isBookingOrPaymentAction(type: string) {
  return type.startsWith("booking/") || ["online/book", "online/waitlist", "inbox/reply", "giftcard/redeem", "giftcard/sell", "package/sell", "product/sell"].includes(type);
}
