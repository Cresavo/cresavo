"use client";

import { CalendarClock, Mail, MapPin, Phone, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t, type MessageKey } from "../i18n";
import { formatDate, formatDayLong, formatTime } from "../i18n/format";
import { useServerReload, useServerSalon } from "../server-salon";
import { noteNetworkFailure } from "../ui/connection";
import { SALON_TIMEZONE } from "../tools/clock";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Sheet } from "../ui/sheet";
import { useCommit } from "../ui/use-commit";
import { useSalonNow } from "../use-now";
import type { PublicBookingView } from "./public-booking-view";
import type { OpenSlot } from "./suggest";
import { mapLink } from "./links";
import { TimePicker } from "./time-picker";

type Change = "cancel" | "move";
type Problem = { key: MessageKey; minutes?: number };

const BUSY_BLOCK = /^busy-/;
/** The longest a timer waits in one go; the cutoff may be weeks away. */
const TICK_MS = 60_000;

const telephone = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Where to turn once online changes are closed: whatever contact details the salon has. */
function CallTheSalon({ salon }: { salon: PublicBookingView["salon"] }) {
  const link = "inline-flex min-h-target items-center gap-2 underline [overflow-wrap:anywhere]";
  return (
    <Notice tone="warning" className="space-y-2">
      <p>{t("bookingView.closed")}</p>
      <ul className="space-y-1">
        {salon.phone && <li><a className={link} href={telephone(salon.phone)}><Phone size={16} aria-hidden />{salon.phone}</a></li>}
        {salon.email && <li><a className={link} href={`mailto:${salon.email}`}><Mail size={16} aria-hidden />{salon.email}</a></li>}
        {salon.address && <li><a className={link} href={mapLink(salon.address)} target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden />{salon.address}<span className="sr-only"> ({t("booking.openMap")})</span></a></li>}
      </ul>
    </Notice>
  );
}

/**
 * What the holder of a booking link may do with the booking: before the
 * salon's free-cancellation deadline cancel it or move it to another free
 * time, free of charge; after it, contact the salon. The server decides every
 * time; a refusal here only explains it. Each request names the visit as it was
 * shown, so a booking changed meanwhile is shown again rather than changed. One
 * key goes with one exact request, so a lost answer can be asked again without
 * changing the booking twice.
 */
export function ManageBooking({ slug, id, token, view, onChanged }: {
  slug: string; id: string; token: string; view: PublicBookingView; onChanged: (view: PublicBookingView) => void;
}) {
  const salon = useServerSalon();
  const reload = useServerReload();
  const now = useSalonNow();
  const [sheet, setSheet] = useState<Change | null>(null);
  const [run, pending] = useCommit();
  const [problem, setProblem] = useState<Problem>();
  const [done, setDone] = useState<MessageKey>();
  const [closed, setClosed] = useState(false);
  const attempt = useRef<{ key: string; intent: string }>(undefined);
  const result = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (done) result.current?.focus(); }, [done]);

  // A page left open past the cutoff turns to the salon's contact details by itself.
  const { closesAt } = view;
  useEffect(() => {
    if (closesAt === undefined || closed) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const left = closesAt - Date.now();
      if (left < 0) setClosed(true);
      else timer = setTimeout(check, Math.min(left + 1, TICK_MS));
    };
    check();
    return () => clearTimeout(timer);
  }, [closesAt, closed]);

  // The page's busy times include this visit; under its own reference and treatment they are the booking being moved, which `TimePicker` leaves out.
  const state = useMemo(() => salon && {
    ...salon,
    bookings: salon.bookings.map((b) => BUSY_BLOCK.test(b.id) && b.staffId === view.staffId && b.date === view.date && b.start === view.start && b.duration === view.duration
      ? { ...b, id, serviceId: view.serviceId } : b),
  }, [salon, view, id]);

  const expected = { staffId: view.staffId, date: view.date, start: view.start };
  const address = `/api/public/salons/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(id)}`;

  /** The booking as it is now, shown again for the customer to confirm anew. */
  const refresh = async () => {
    const response = await fetch(address, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" }).catch(() => null);
    if (!response) noteNetworkFailure();
    const body = response?.ok ? await response.json().catch(() => null) as { booking?: PublicBookingView } | null : null;
    if (body?.booking) onChanged(body.booking);
  };

  const send = (change: Change, body: Record<string, unknown> = {}) => run(async () => {
    const intent = JSON.stringify([change, expected, body]);
    if (attempt.current?.intent !== intent) attempt.current = { key: crypto.randomUUID(), intent };
    const post = () => fetch(`${address}/${change}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current!.key }, body: JSON.stringify({ token, expected, ...body }), cache: "no-store",
    }).catch(() => null);
    let response = await post();
    if (!response) noteNetworkFailure();
    // The salon was busy for a moment: after the wait it asks for, the same key makes the second try safe.
    if (response?.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(Number(response!.headers.get("Retry-After")) || 1, 0), 10) * 1000));
      response = await post();
      if (!response) noteNetworkFailure();
    }
    if (response && response.status !== 503 && response.status !== 429) attempt.current = undefined;
    const answer = response ? await response.json().catch(() => ({})) as { booking?: PublicBookingView; error?: string } : {};
    if (response?.ok && answer.booking) {
      setProblem(undefined);
      setSheet(null);
      setDone(change === "cancel" ? "booking.cancel.done" : "booking.move.done");
      onChanged(answer.booking);
    } else if (answer.error === "call_salon") {
      setSheet(null);
      setClosed(true);
    } else if (answer.error === "not_changeable") {
      setSheet(null);
      setClosed(true);
      setProblem({ key: "bookingView.notChangeable" });
    } else if (answer.error === "changed") {
      setSheet(null);
      setProblem({ key: "bookingView.changed" });
      await refresh();
    } else if (answer.error === "slot_unavailable") {
      setProblem({ key: "bookingView.slotTaken" });
      await reload();
    } else if (response?.status === 429) {
      setProblem({ key: "booking.tooManyAttempts", minutes: Math.max(1, Math.ceil(Number(response.headers.get("Retry-After") ?? 60) / 60)) });
    } else {
      setProblem({ key: "bookingView.failed" });
    }
  });

  const message = problem && <p role="alert" className="text-meta text-danger">{t(problem.key, { minutes: problem.minutes ?? 0, phone: view.salon.phone })}</p>;
  if (done) return <p ref={result} tabIndex={-1} role="status" className="text-center font-medium outline-none">{t(done)}</p>;
  if (view.status !== "booked") return null;
  const when = `${formatDayLong(view.date)} ${formatTime(view.start)}`;
  if (!view.freeUntil || closed) return <div className="space-y-2 text-meta">{message}<CallTheSalon salon={view.salon} /></div>;
  return (
    <div className="space-y-3 text-meta">
      <p className="text-text-secondary">{t("booking.cancelUntil", { day: formatDate(view.freeUntil.date), time: formatTime(view.freeUntil.time), zone: SALON_TIMEZONE })}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<CalendarClock size={16} />} onClick={() => { setProblem(undefined); setSheet("move"); void reload(); }}>{t("bookingView.changeTime")}</Button>
        <Button variant="danger" icon={<XCircle size={16} />} onClick={() => { setProblem(undefined); setSheet("cancel"); }}>{t("booking.cancel")}</Button>
      </div>
      {sheet !== "move" && message}
      <Sheet
        open={sheet === "cancel"} onClose={() => setSheet(null)} title={t("booking.cancel.title")} description={t("booking.cancel.text", { service: view.treatment, when })}
        footer={<>
          <Button variant="secondary" onClick={() => setSheet(null)}>{t("booking.cancel.keep")}</Button>
          <Button variant="danger" disabled={pending} onClick={() => send("cancel")}>{t("booking.cancel.confirm")}</Button>
        </>}
      >
        {message}
      </Sheet>
      <Sheet open={sheet === "move"} onClose={() => setSheet(null)} title={t("booking.move.title")} description={t("bookingView.pickTime", { treatment: view.treatment })}>
        <div className="space-y-3 pt-3">
          {message}
          {state && <TimePicker
            state={state} serviceId={view.serviceId} clock={now} ignoreId={id} disabled={pending} onWaitlist={() => undefined}
            onPick={(slot: OpenSlot) => send("move", { staffId: slot.staffId, date: slot.date, start: slot.start })}
          />}
        </div>
      </Sheet>
    </div>
  );
}
