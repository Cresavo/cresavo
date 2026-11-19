"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { bookingView, itemView, proposalView } from "../../pairing/appointments";
import { t } from "../../i18n";
import { showToast } from "../../ui/toast";

interface Workspace {
  id: string;
  revision: number;
  expiresAt: string;
  client: { clientName: string; scopes: string } | null;
  bookings: ReturnType<typeof bookingView>[];
  items: ReturnType<typeof itemView>[];
  proposals: ReturnType<typeof proposalView>[];
}
interface Pairing {
  workspace: Workspace | null;
  minutesLeft: number;
  ready: boolean;
  busy: boolean;
  command(path: string, args: Record<string, unknown>): Promise<boolean>;
}
const Context = createContext<Pairing | null>(null);
export const usePairing = () => useContext(Context);
const prefix = "cresavo-pairing:";
function cache(workspace: Workspace | null) {
  try {
    const current = workspace && prefix + workspace.id;
    for (const key of Object.keys(localStorage)) if (key.startsWith(prefix) && key !== current) localStorage.removeItem(key);
    if (current) localStorage.setItem(current, JSON.stringify(workspace));
  } catch { /* The authenticated server copy is sufficient. */ }
}
export function PairingProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [minutesLeft, setMinutesLeft] = useState(60);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const sequence = useRef(0);
  const tag = useRef("");
  const load = useCallback(async () => {
    if (document.hidden) return;
    const version = ++sequence.current;
    const res = await fetch("/api/pairing/session", { cache: "no-store", headers: tag.current ? { "If-None-Match": tag.current } : {} });
    if (version !== sequence.current) return;
    const expires = res.headers.get("x-pair-expiry");
    if (expires) setMinutesLeft(Math.max(0, Math.ceil((Date.parse(expires) - Date.now()) / 60000)));
    if (res.status === 304) {
      if (expires) setWorkspace(w => w && w.expiresAt !== expires ? { ...w, expiresAt: expires } : w);
      return;
    }
    if (!res.ok && res.status !== 401) throw new Error("pairing_unavailable");
    const next: Workspace | null = res.ok ? await res.json() : null;
    if (version !== sequence.current) return;
    tag.current = res.headers.get("etag") ?? "";
    cache(next);
    setWorkspace(next);
    setReady(true);
  }, []);
  const expiry = workspace?.expiresAt;
  useEffect(() => {
    if (!expiry) return;
    // A suspended or offline studio must also drop its expired view.
    const timeout = window.setTimeout(() => {
      tag.current = "";
      cache(null);
      setWorkspace(null);
      void load().catch(() => undefined);
    }, Math.max(0, Date.parse(expiry) - Date.now()));
    return () => clearTimeout(timeout);
  }, [expiry, load]);
  const paired = !!workspace;
  useEffect(() => {
    const refresh = () => { void load().catch(() => setReady(true)); };
    // Another tab may have started or disconnected a workspace. Always
    // authenticate before adopting anything from that tab.
    const changed = (e: StorageEvent) => {
      if (e.key?.startsWith(prefix) && (!e.oldValue || !e.newValue)) refresh();
    };
    let active = true;
    let timer: number | undefined;
    async function poll() {
      try { await load(); } catch { if (active) setReady(true); }
      if (active && paired) timer = window.setTimeout(poll, 2500);
    }
    void poll();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", refresh);
    const invalidate = () => { sequence.current++; };
    return () => {
      active = false;
      invalidate();
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", changed);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, paired]);
  async function command(path: string, args: Record<string, unknown>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/pairing/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
      const result = response.status !== 204 ? await response.json() : null;
      const success = response.ok && result?.status !== "conflict";
      if (!success) showToast(t(response.status === 429 ? "pair.limit" : "pair.retry"));
      if (success && result?.status === "applied") showToast(t("pair.applied"));
      if (success && result?.status === "declined") showToast(t("agents.declined"));
      await load();
      return success;
    } catch {
      showToast(t("pair.network"));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return <Context.Provider value={{ workspace, ready, busy, minutesLeft, command }}>{children}</Context.Provider>;
}
