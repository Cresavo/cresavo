"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { quote } from "./booking/protection";
import { acceptedTerms } from "./booking/public-terms";
import { timingOf } from "./data/slots";
import type { Booking, DemoState, StaffId } from "./data/types";
import { getActiveLocale } from "./i18n";

// A salon the server sent to the booking pages (`publicSalonView`), instead of
// the browser's own copy, and the one way those pages book on it. Without a
// provider the pages run on browser state as in the demo.

/** What the customer typed, and the time they chose. */
export interface ServerBookingInput {
  serviceId: string;
  staffId: StaffId;
  date: string;
  start: number;
  name: string;
  phone: string;
  email: string;
  /** The honeypot: a person leaves it empty. */
  website: string;
}

export type ServerBookingResult =
  | { ok: true; booking: Booking }
  /** `unavailable`: nothing was booked or it is not known; sending the same key again is safe. */
  | { ok: false; reason: "slot_unavailable" | "terms_changed" | "deposit_unsupported" | "unavailable" }
  /** Too many attempts from this address or for this salon; `minutes` until it is open again. */
  | { ok: false; reason: "rate_limited"; minutes: number };

interface ServerSalonValue {
  state: DemoState;
  book: (input: ServerBookingInput) => Promise<ServerBookingResult>;
  /** Asks the server for the salon's free times again. */
  reload: () => Promise<void>;
}

const ServerSalon = createContext<ServerSalonValue | null>(null);

export const useServerSalon = () => useContext(ServerSalon)?.state ?? null;

/** Refreshes the server salon's free times; does nothing on the browser's own salon. */
const NO_RELOAD = async () => undefined;
export const useServerReload = () => useContext(ServerSalon)?.reload ?? NO_RELOAD;

/** Books on the server's salon; null on the browser's own salon. */
export const useServerBook = () => useContext(ServerSalon)?.book ?? null;

const json = (response: Response) => response.json().catch(() => ({})) as Promise<{ error?: string; state?: DemoState; issuedAt?: string; duration?: number; ref?: string }>;

export function ServerSalonProvider({ state, issuedAt, children }: { state: DemoState; issuedAt: string; children: ReactNode }) {
  const [salon, setSalon] = useState(state);
  // The visits made on this page: the projection shows others' visits as busy times only.
  const [made, setMade] = useState<Booking[]>([]);
  const token = useRef(issuedAt);
  // The one attempt that may be in doubt: its key, with the exact body it was first sent as.
  const attempt = useRef<{ key: string; intent: string; body: string } | undefined>(undefined);
  const address = `/api/public/salons/${encodeURIComponent(salon.salon.slug)}`;

  /** The salon's free times as they are now, and a fresh form-time token. */
  const reload = useCallback(async () => {
    const body = await fetch(address, { cache: "no-store" }).then(json).catch(() => null);
    if (body?.state && body.issuedAt) {
      token.current = body.issuedAt;
      setSalon(body.state);
    }
  }, [address]);

  const book = useCallback(async (input: ServerBookingInput): Promise<ServerBookingResult> => {
    const service = salon.services.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, reason: "slot_unavailable" };
    // One key always travels with one exact body. After a lost answer the same intent re-sends that body under that key;
    // a changed form, quote or language is another intent and gets a key of its own.
    const intent = JSON.stringify({ ...input, language: getActiveLocale(), terms: acceptedTerms(salon, service) });
    if (attempt.current?.intent !== intent) attempt.current = { key: crypto.randomUUID(), intent, body: JSON.stringify({ ...JSON.parse(intent), issuedAt: token.current }) };
    const { key, body: sent } = attempt.current;
    const send = () => fetch(`${address}/bookings`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: sent });
    let response = await send().catch(() => null);
    // The salon was busy for a moment: after the wait it asks for, the same key makes the second try safe.
    if (response?.status === 503) {
      const asked = Number(response.headers.get("Retry-After"));
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(Number.isFinite(asked) ? asked : 1, 0), 10) * 1000));
      response = await send().catch(() => null);
    }
    // Nothing is in doubt once the salon has answered, except that it was busy or the answer never came.
    if (response && response.status !== 503 && response.status !== 429) attempt.current = undefined;
    if (response?.status === 429) return { ok: false, reason: "rate_limited", minutes: Math.max(1, Math.ceil(Number(response.headers.get("Retry-After") ?? 60) / 60)) };
    const body = response ? await json(response) : {};
    if (response?.status === 201 && body.ref) {
      const booking: Booking = {
        id: body.ref, customerId: "", staffId: input.staffId, serviceId: service.id, date: input.date, start: input.start,
        duration: body.duration ?? service.duration, price: service.price, status: "booked", source: "online",
        protection: { terms: { ...quote(salon.cancellationPolicy, service, salon.localization.currency, true), depositMinor: 0 } }, ...timingOf(service),
      };
      setMade((previous) => [...previous, booking]);
      return { ok: true, booking };
    }
    const reason = body.error === "slot_unavailable" || body.error === "terms_changed" || body.error === "deposit_unsupported" ? body.error : "unavailable";
    // Free times that were stale, and a form-time token that was refused, are both fixed by asking again.
    if (reason !== "deposit_unsupported") await reload();
    return { ok: false, reason };
  }, [salon, address, reload]);

  const value = useMemo(() => ({ state: made.length ? { ...salon, bookings: [...salon.bookings, ...made] } : salon, book, reload }), [salon, made, book, reload]);
  return <ServerSalon.Provider value={value}>{children}</ServerSalon.Provider>;
}
