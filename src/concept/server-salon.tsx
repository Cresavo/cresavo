"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { quote } from "./booking/protection";
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
  | { ok: false; reason: "slot_unavailable" | "terms_changed" | "deposit_unsupported" | "unavailable" };

interface ServerSalonValue {
  state: DemoState;
  book: (input: ServerBookingInput, idempotencyKey: string) => Promise<ServerBookingResult>;
}

const ServerSalon = createContext<ServerSalonValue | null>(null);

export const useServerSalon = () => useContext(ServerSalon)?.state ?? null;

/** Books on the server's salon; null on the browser's own salon. */
export const useServerBook = () => useContext(ServerSalon)?.book ?? null;

const json = (response: Response) => response.json().catch(() => ({})) as Promise<{ error?: string; state?: DemoState; issuedAt?: string; duration?: number; bookingId?: string }>;

export function ServerSalonProvider({ state, issuedAt, children }: { state: DemoState; issuedAt: string; children: ReactNode }) {
  const [salon, setSalon] = useState(state);
  // The visits made on this page: the projection shows others' visits as busy times only.
  const [made, setMade] = useState<Booking[]>([]);
  const token = useRef(issuedAt);
  const address = `/api/public/salons/${encodeURIComponent(salon.salon.slug)}`;

  /** The salon's free times as they are now, and a fresh form-time token. */
  const reload = useCallback(async () => {
    const body = await fetch(address, { cache: "no-store" }).then(json).catch(() => null);
    if (body?.state && body.issuedAt) {
      token.current = body.issuedAt;
      setSalon(body.state);
    }
  }, [address]);

  const book = useCallback(async (input: ServerBookingInput, idempotencyKey: string): Promise<ServerBookingResult> => {
    const service = salon.services.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, reason: "slot_unavailable" };
    const send = () => fetch(`${address}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ...input, language: getActiveLocale(), issuedAt: token.current, price: service.price, duration: service.duration }),
    });
    let response = await send().catch(() => null);
    // The salon was busy for a moment: the same key makes the second try safe.
    if (response?.status === 503) response = await send().catch(() => null);
    const body = response ? await json(response) : {};
    if (response?.status === 201 && body.bookingId) {
      const booking: Booking = {
        id: body.bookingId, customerId: "", staffId: input.staffId, serviceId: service.id, date: input.date, start: input.start,
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

  const value = useMemo(() => ({ state: made.length ? { ...salon, bookings: [...salon.bookings, ...made] } : salon, book }), [salon, made, book]);
  return <ServerSalon.Provider value={value}>{children}</ServerSalon.Provider>;
}
