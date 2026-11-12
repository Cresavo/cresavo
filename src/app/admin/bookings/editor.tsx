"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBookingTime, formatPrice } from "@/lib/format";
import type { BookingView, StaffView, ServiceView } from "../types";
import { useWrite, useUnsavedChanges } from "../use-write";

function dayOf(instant: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
export default function BookingEditor({
  services,
  staff,
  booking,
  date,
}: {
  services: ServiceView[];
  staff: StaffView[];
  booking?: BookingView;
  date?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(booking),
    [mode, setMode] = useState<"view" | "edit">(booking ? "view" : "edit"),
    [confirmCancel, setConfirmCancel] = useState(false);
  const [serviceId, setService] = useState(
    booking?.serviceId ?? services.find((s) => s.active)?.id ?? "",
  );
  const [staffId, setStaff] = useState(
    booking?.staffId ??
      staff.find((p) => p.active && p.serviceIds.includes(serviceId))?.id ??
      "",
  );
  const [day, setDay] = useState(
      booking ? dayOf(booking.startsAt) : (date ?? ""),
    ),
    [slots, setSlots] = useState<string[]>([]),
    [start, setStart] = useState("");
  const [searching, setSearching] = useState(false),
    [readError, setReadError] = useState(""),
    [notice, setNotice] = useState("");
  const [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState("");
  const searchVersion = useRef(0);
  const { write, pending, message, status } = useWrite();
  const { markDirty, markClean } = useUnsavedChanges();
  const people = staff.filter(
    (p) => p.active && p.serviceIds.includes(serviceId),
  );
  function clearSlots(dirty = true) {
    searchVersion.current++;
    setSearching(false);
    setSlots([]);
    setStart("");
    setReadError("");
    if (dirty) markDirty();
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const version = ++searchVersion.current;
    setSearching(true);
    setReadError("");
    setSlots([]);
    setStart("");
    try {
      const query = new URLSearchParams({ serviceId, staffId, date: day });
      const url = current
        ? `/api/admin/bookings/${encodeURIComponent(current.id)}/availability?${query}`
        : `/api/availability?${query}`;
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (version !== searchVersion.current) return;
      if (!response.ok) {
        setReadError(data.error ?? "Tiderna kunde inte hämtas.");
        return;
      }
      setSlots(data);
      if (!data.length) setReadError("Inga lediga tider detta datum.");
    } catch {
      if (version === searchVersion.current)
        setReadError("Tiderna kunde inte hämtas. Försök igen.");
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = current
      ? {
          action: "move",
          id: current.id,
          expectedVersion: current.version,
          staffId,
          start,
        }
      : {
          action: "create",
          serviceId,
          serviceVersion: services.find((s) => s.id === serviceId)?.version,
          staffId,
          start,
          customerName: form.get("name"),
          customerEmail: form.get("email"),
        };
    const result = await write<{
      id: string;
      version: number;
      status: string;
      startsAt: string;
      endsAt: string;
      staffId: string;
    }>("/api/admin/bookings", input);
    if (!result) return;
    markClean();
    if (!current) {
      router.push(`/admin/bookings/${encodeURIComponent(result.id)}`);
      return;
    }
    setCurrent({ ...current, ...result });
    setMode("view");
    setSlots([]);
    setStart("");
    await reload();
    setNotice("Bokningen har flyttats.");
  }
  async function cancel() {
    if (!current) return;
    const result = await write<{ version: number; status: string }>(
      "/api/admin/bookings",
      { action: "cancel", id: current.id, expectedVersion: current.version },
    );
    if (result) {
      markClean();
      setCurrent({ ...current, ...result });
      setConfirmCancel(false);
      await reload();
      setNotice("Bokningen är avbokad.");
    }
  }
  async function reload() {
    if (!current) return;
    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(current.id)}`,
        { cache: "no-store" },
      );
      const value = await response.json();
      if (!response.ok) {
        setReadError(value.error ?? "Bokningen kunde inte hämtas.");
        return;
      }
      markClean();
      setCurrent(value);
      setService(value.serviceId);
      setStaff(value.staffId);
      setDay(dayOf(value.startsAt));
      setMode("view");
      setConfirmCancel(false);
      setNotice("Bokningen är uppdaterad.");
    } catch {
      setReadError("Bokningen kunde inte hämtas. Försök igen.");
    }
  }
  return (
    <>
      <p>
        <a href={`/admin?date=${current ? dayOf(current.startsAt) : day}`}>
          Till kalendern
        </a>
      </p>
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {current && (
        <section className="panel booking-summary">
          <div className="section-heading">
            <h2>{current.serviceName}</h2>
            <span
              className={
                current.status === "cancelled"
                  ? "status-pill cancelled"
                  : "status-pill"
              }
            >
              {current.status === "cancelled" ? "Avbokad" : "Bokad"}
            </span>
          </div>
          <p className="booking-date">
            {formatBookingTime(current.startsAt)}–
            {new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Stockholm",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(current.endsAt))}
          </p>
          <p>
            {staff.find((p) => p.id === current.staffId)?.name ??
              "Tidigare medarbetare"}{" "}
            · {current.duration} min
            {current.buffer > 0
              ? ` + ${current.buffer} min buffert`
              : ""} · {formatPrice(current.priceOre)}
          </p>
          <p>
            {current.customerName} · {current.customerEmail}
          </p>
          {current.status === "confirmed" &&
            mode === "view" &&
            !confirmCancel && (
              <div className="action-row">
                <button
                  onClick={() => {
                    setMode("edit");
                    setStaff(current.staffId);
                    setDay(dayOf(current.startsAt));
                    clearSlots(false);
                  }}
                >
                  Flytta
                </button>
                <button
                  className="danger-secondary"
                  onClick={() => setConfirmCancel(true)}
                >
                  Avboka
                </button>
              </div>
            )}
        </section>
      )}
      {confirmCancel && (
        <section className="panel confirm-panel" aria-labelledby="cancel-title">
          <h2 id="cancel-title">Avboka bokningen?</h2>
          <p>Tiden blir ledig. Bokningen och historiken finns kvar.</p>
          <div className="action-row">
            <button
              className="danger"
              autoFocus
              disabled={pending}
              onClick={cancel}
            >
              {pending ? "Avbokar…" : "Ja, avboka"}
            </button>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => setConfirmCancel(false)}
            >
              Behåll bokningen
            </button>
          </div>
        </section>
      )}
      {mode === "edit" && (
        <section className="panel">
          <h2>{current ? "Välj ny tid" : "Behandling och tid"}</h2>
          <form onSubmit={search}>
            <fieldset disabled={pending}>
              {!current && (
                <div className="field">
                  <label htmlFor="booking-service">Behandling</label>
                  <select
                    id="booking-service"
                    value={serviceId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setService(value);
                      setStaff(
                        staff.find(
                          (p) => p.active && p.serviceIds.includes(value),
                        )?.id ?? "",
                      );
                      clearSlots();
                    }}
                  >
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {formatPrice(s.priceOre)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="booking-staff">Medarbetare</label>
                  <select
                    id="booking-staff"
                    value={staffId}
                    required
                    onChange={(e) => {
                      setStaff(e.target.value);
                      clearSlots();
                    }}
                  >
                    <option value="">Välj medarbetare</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="booking-date">Datum</label>
                  <input
                    id="booking-date"
                    type="text"
                    lang="sv-SE"
                    placeholder="YYYY-MM-DD"
                    pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                    required
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value);
                      clearSlots();
                    }}
                  />
                </div>
              </div>
              <button
                className="secondary"
                disabled={searching || !staffId || !serviceId}
                type="submit"
              >
                {searching ? "Hämtar tider…" : "Visa lediga tider"}
              </button>
            </fieldset>
          </form>
          {readError && (
            <p role="status" className="form-message">
              {readError}
            </p>
          )}
          {!!slots.length && (
            <form
              onSubmit={save}
              onChange={markDirty}
              className="booking-write-form"
            >
              <fieldset disabled={pending}>
                <div className="field">
                  <label htmlFor="booking-slot">Ledig tid</label>
                  <select
                    id="booking-slot"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  >
                    <option value="">Välj tid</option>
                    {slots.map((slot) => (
                      <option key={slot} value={slot}>
                        {new Intl.DateTimeFormat("sv-SE", {
                          timeZone: "Europe/Stockholm",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(slot))}
                      </option>
                    ))}
                  </select>
                </div>
                {!current && (
                  <>
                    <div className="field">
                      <label htmlFor="booking-name">Namn (påhittat)</label>
                      <input
                        id="booking-name"
                        name="name"
                        minLength={2}
                        maxLength={80}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="booking-email">E-post (påhittad)</label>
                      <input
                        id="booking-email"
                        name="email"
                        type="email"
                        maxLength={254}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="action-row">
                  <button disabled={!start}>
                    {pending
                      ? "Sparar…"
                      : current
                        ? "Spara flytt"
                        : "Skapa bokning"}
                  </button>
                  {current && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setMode("view");
                        markClean();
                      }}
                    >
                      Avbryt
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
        </section>
      )}
      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      {readError && mode === "view" && (
        <p role="alert" className="form-error">
          {readError}
        </p>
      )}
      {status === 409 && current && (
        <button className="secondary" onClick={reload}>
          Läs in bokningen på nytt
        </button>
      )}
      {current && current.events.length > 0 && (
        <details className="panel">
          <summary>Historik</summary>
          <ul className="event-list">
            {current.events.map((event, index) => (
              <li key={`${event.createdAt}-${index}`}>
                <strong>
                  {event.action === "create"
                    ? "Skapad"
                    : event.action === "move"
                      ? "Flyttad"
                      : "Avbokad"}
                </strong>{" "}
                · {formatBookingTime(event.createdAt)}
                {event.previousStart && event.nextStart && (
                  <span>
                    {formatBookingTime(event.previousStart)} →{" "}
                    {formatBookingTime(event.nextStart)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">De senaste 20 händelserna.</p>
        </details>
      )}
    </>
  );
}
