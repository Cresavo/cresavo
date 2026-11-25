"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Whether the server can be reached. `navigator.onLine` only says a network is there (a VPN or a captive portal
 * can make it lie), so every doubt is settled by asking the server itself. Any answer counts as online, even an
 * error page; only a request that never arrives counts as offline.
 */
export type Connection = "online" | "offline" | "checking";

/** A small static file every host serves, outside the app's own routing. */
const PROBE = "/favicon.ico";
const PROBE_TIMEOUT_MS = 8000;
/** While offline, look again now and then, quietly. Nothing on screen counts down to it. */
const RECHECK_MS = 15000;

let connection: Connection = "online";
let checking: Promise<boolean> | null = null;
let recheck: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function set(next: Connection) {
  if (next === connection) return;
  connection = next;
  listeners.forEach((listener) => listener());
}

/** Ask the server once. Calls made while one is on its way share its answer. */
export async function reachServer(request: typeof fetch = fetch): Promise<boolean> {
  try {
    await request(`${PROBE}?connection=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

/** Check against the server and update every banner. Returns whether it answered. */
export function checkConnection(): Promise<boolean> {
  if (checking) return checking;
  if (connection === "offline") set("checking");
  checking = reachServer().then((ok) => {
    checking = null;
    set(ok ? "online" : "offline");
    clearInterval(recheck);
    recheck = ok ? undefined : setInterval(() => void checkConnection(), RECHECK_MS);
    return ok;
  });
  return checking;
}

/** A request of the app's own failed without an answer: find out whether the connection is gone. */
export function noteNetworkFailure() {
  if (typeof window !== "undefined") void checkConnection();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The connection as last checked. Mounting it starts listening to the browser's own online and offline events. */
export function useConnection(): Connection {
  useEffect(() => {
    const check = () => void checkConnection();
    if (!navigator.onLine) check();
    window.addEventListener("offline", check);
    window.addEventListener("online", check);
    return () => {
      window.removeEventListener("offline", check);
      window.removeEventListener("online", check);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => connection, () => "online");
}
