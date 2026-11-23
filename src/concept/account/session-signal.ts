"use client";

// Tells every tab of this browser that the owner session changed (sign-in, sign-out, sign out everywhere),
// so caches tied to the old session are emptied there too. BroadcastChannel where the browser has it, and
// a storage event as the fallback; neither carries anything but the fact of a change.

const CHANNEL = "cresavo-owner-session";
const KEY = "cresavo-owner-session-change";

let channel: BroadcastChannel | null | undefined;
const open = () => {
  if (channel === undefined) channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  return channel;
};

/** Announces a session change to the other tabs (this tab clears its own caches itself). */
export function signalSessionChange() {
  open()?.postMessage("changed");
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage may be blocked; the channel and the focus check still apply.
  }
}

/** Calls `listener` when another tab announces a session change. */
export function onSessionSignal(listener: () => void): () => void {
  const fromChannel = () => listener();
  const fromStorage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  open()?.addEventListener("message", fromChannel);
  window.addEventListener("storage", fromStorage);
  return () => {
    channel?.removeEventListener("message", fromChannel);
    window.removeEventListener("storage", fromStorage);
  };
}
