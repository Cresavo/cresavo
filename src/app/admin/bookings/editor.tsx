"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
import { formatPrice, readableDay } from "@/lib/format";
import type { BookingView, StaffView, ServiceView } from "../types";
import { useWrite, useUnsavedChanges } from "../use-write";
import { DateTime } from "luxon";
import DatePicker from "../../components/date-picker";
import SlotPicker from "../../components/slot-picker";
import { useAvailability } from "../../components/use-availability";
import CustomerPicker, { type CustomerChoice } from "../customers/picker";
import ContextLink, { ReturnLink } from "../../components/context-link";
import {
  contextualHref,
  returnHref,
  type ReturnContext,
} from "@/lib/navigation-context";

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
  customer,
  preferredService,
  preferredStaff,
  context = {},
}: {
  services: ServiceView[];
  staff: StaffView[];
  booking?: BookingView;
  date?: string;
  customer?: CustomerChoice;
  preferredService?: string;
  preferredStaff?: string;
  context?: ReturnContext;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [current, setCurrent] = useState(booking),
    [mode, setMode] = useState<"view" | "edit">(booking ? "view" : "edit"),
    [confirmCancel, setConfirmCancel] = useState(false);
  const [serviceId, setService] = useState(
    booking?.serviceId ??
      preferredService ??
      services.find((s) => s.active)?.id ??
      "",
  );
  const [staffId, setStaff] = useState(
    booking?.staffId ??
      preferredStaff ??
      staff.find((p) => p.active && p.serviceIds.includes(serviceId))?.id ??
      "",
  );
  const [day, setDay] = useState(
      booking ? dayOf(booking.startsAt) : (date ?? ""),
    ),
    [start, setStart] = useState("");
  const [readError, setReadError] = useState(""),
    [notice, setNotice] = useState("");
  const [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(customer);
  const availability = useAvailability(
    mode === "edit" ? serviceId : "",
    staffId,
    day,
    current
      ? `/api/admin/bookings/${encodeURIComponent(current.id)}/availability`
      : "/api/availability",
  );
  const { slots } = availability;
  const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!;
  const { write, pending, message, status, clearFeedback } = useWrite();
  const initialSelection = JSON.stringify({
    serviceId,
    staffId,
    day,
    start,
    customerName,
    customerEmail,
    customerId: selectedCustomer?.id,
  });
  const [originalSelection] = useState(initialSelection);
  const changed = current
    ? mode === "edit" &&
      (staffId !== current.staffId ||
        day !== dayOf(current.startsAt) ||
        (!!start && start !== current.startsAt))
    : initialSelection !== originalSelection;
  const { markDirty, markClean } = useUnsavedChanges(changed);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null),
    noticeElement = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeElement.current?.focus();
  }, [notice]);
  function abandonMove() {
    clearFeedback();
    setReadError("");
    setMode("view");
    setStart("");
    setNotice("");
    markClean();
    requestAnimationFrame(() => editButton.current?.focus());
  }
  const people = staff.filter(
    (p) => p.active && p.serviceIds.includes(serviceId),
  );
  function clearSlots(dirty = true) {
    availability.refresh();
    setStart("");
    setReadError("");
    if (dirty) markDirty();
  }
  function search(event: React.FormEvent) {
    event.preventDefault();
    setStart("");
    availability.refresh();
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
          ...(selectedCustomer
            ? { customerId: selectedCustomer.id }
            : {
                customerName: form.get("name"),
                customerEmail: form.get("email"),
              }),
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
      router.push(
        contextualHref(
          `/admin/bookings/${encodeURIComponent(result.id)}`,
          context,
        ),
      );
      return;
    }
    setCurrent({ ...current, ...result });
    setMode("view");
    setStart("");
    await reload();
    setNotice(t("Booking moved.", "Bokningen har flyttats."));
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
      setNotice(t("Booking cancelled.", "Bokningen är avbokad."));
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
      setNotice(t("Booking refreshed.", "Bokningen är uppdaterad."));
      router.refresh();
    } catch {
      setReadError("Bokningen kunde inte hämtas. Försök igen.");
    }
  }
  return (
    <>
      <ReturnLink
        context={context}
        fallback={`/admin?date=${current ? dayOf(current.startsAt) : day}`}
      />
      {notice && (
        <p
          ref={noticeElement}
          tabIndex={-1}
          className="success-message"
          role="status"
        >
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
              {current.status === "cancelled"
                ? t("Cancelled", "Avbokad")
                : t("Confirmed", "Bokad")}
            </span>
          </div>
          <p className="booking-date">
            {readableDay(dayOf(current.startsAt), locale)}
            {t(" at ", " kl. ")}
            {DateTime.fromISO(current.startsAt, {
              zone: "Europe/Stockholm",
            }).toFormat("HH:mm")}
            –
            {new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Stockholm",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(current.endsAt))}
          </p>
          <p>
            {staff.find((p) => p.id === current.staffId)?.name ??
              t("Former team member", "Tidigare medarbetare")}{" "}
            · {current.duration} min
            {current.buffer > 0
              ? ` + ${current.buffer} min ${t("buffer", "buffert")}`
              : ""}{" "}
            · {formatPrice(current.priceOre, locale)}
          </p>
          <p>
            {current.customerName} · {current.customerEmail}
          </p>
          {current.customerId && (
            <p>
              <ContextLink
                href={`/admin/customers/${encodeURIComponent(current.customerId)}`}
              >
                {t("Open customer", "Öppna kundkort")}
              </ContextLink>
              <small>
                {" "}
                {t(
                  "The name above was recorded when this booking was made.",
                  "Namnet ovan är uppgiften som registrerades vid bokningen.",
                )}
              </small>
            </p>
          )}
          {current.status === "confirmed" &&
            mode === "view" &&
            !confirmCancel && (
              <div className="action-row">
                <button
                  ref={editButton}
                  onClick={() => {
                    setNotice("");
                    setMode("edit");
                    setStaff(current.staffId);
                    setDay(dayOf(current.startsAt));
                    clearSlots(false);
                  }}
                >
                  {t("Reschedule", "Flytta")}
                </button>
                <button
                  className="danger-secondary"
                  ref={cancelButton}
                  onClick={() => setConfirmCancel(true)}
                >
                  {t("Cancel booking", "Avboka")}
                </button>
              </div>
            )}
        </section>
      )}
      {!current && (
        <CustomerPicker
          value={selectedCustomer}
          onChange={(value) => {
            setSelectedCustomer(value);
            markDirty();
          }}
        />
      )}
      {confirmCancel && (
        <section className="panel confirm-panel" aria-labelledby="cancel-title">
          <h2 id="cancel-title">
            {t("Cancel this booking?", "Avboka bokningen?")}
          </h2>
          <p>
            {t(
              "This frees up the time. The booking and its history are kept.",
              "Tiden blir ledig. Bokningen och historiken finns kvar.",
            )}
          </p>
          <div className="action-row">
            <button className="danger" disabled={pending} onClick={cancel}>
              {pending
                ? t("Cancelling…", "Avbokar…")
                : t("Yes, cancel booking", "Ja, avboka")}
            </button>
            <button
              className="secondary"
              disabled={pending}
              autoFocus
              onClick={() => {
                setConfirmCancel(false);
                requestAnimationFrame(() => cancelButton.current?.focus());
              }}
            >
              {t("Keep booking", "Behåll bokningen")}
            </button>
          </div>
        </section>
      )}
      {mode === "edit" && (
        <section className="panel">
          <h2>
            {current
              ? t("Choose a new time", "Välj ny tid")
              : t("Treatment and time", "Behandling och tid")}
          </h2>
          <form onSubmit={search}>
            <fieldset disabled={pending}>
              {!current && (
                <div className="field">
                  <label htmlFor="booking-service">
                    {t("Treatment", "Behandling")}
                  </label>
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
                          {s.name} · {formatPrice(s.priceOre, locale)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="booking-staff">
                    {t("Team member", "Medarbetare")}
                  </label>
                  <select
                    id="booking-staff"
                    value={staffId}
                    required
                    onChange={(e) => {
                      setStaff(e.target.value);
                      clearSlots();
                    }}
                  >
                    <option value="">
                      {t("Choose team member", "Välj medarbetare")}
                    </option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <DatePicker
                    id="booking-date"
                    value={day}
                    min={today}
                    max={
                      DateTime.fromISO(today).plus({ days: 60 }).toISODate()!
                    }
                    onChange={(value) => {
                      setDay(value);
                      clearSlots();
                    }}
                  />
                </div>
              </div>
              <button
                className="secondary"
                disabled={availability.loading || !staffId || !serviceId}
                type="submit"
              >
                {availability.loading
                  ? t("Loading times…", "Hämtar tider…")
                  : t("Refresh available times", "Uppdatera lediga tider")}
              </button>
            </fieldset>
          </form>
          {readError && (
            <p role="status" className="form-message">
              {presentationError(readError, locale)}
            </p>
          )}
          {availability.error && (
            <p className="form-error" role="alert">
              {presentationError(availability.error, locale)}
            </p>
          )}
          {!availability.loading && !availability.error && !slots.length && (
            <p className="empty-state">
              {t(
                "No times available that day. The business may be closed or fully booked.",
                "Inga lediga tider den här dagen. Det kan vara stängt eller fullbokat.",
              )}
            </p>
          )}
          <button
            type="button"
            className="secondary next-available"
            disabled={pending || availability.finding || !staffId}
            onClick={() =>
              void availability.next((value) => {
                setDay(value);
                clearSlots();
              })
            }
          >
            {availability.finding
              ? t(
                  "Finding the next available day…",
                  "Letar efter en ledig dag…",
                )
              : t("Find next available day", "Hitta nästa lediga dag")}
          </button>
          {current && !slots.length && (
            <button
              type="button"
              className="quiet-button"
              onClick={() => {
                abandonMove();
              }}
            >
              {t("Keep original time", "Avbryt flytt")}
            </button>
          )}
          {!!slots.length && (
            <form
              onSubmit={save}
              onChange={markDirty}
              className="booking-write-form"
            >
              <fieldset disabled={pending}>
                <div className="field">
                  <SlotPicker
                    id="booking-slot"
                    slots={slots}
                    value={start}
                    onChange={(value) => {
                      setStart(value);
                      markDirty();
                    }}
                    disabled={pending}
                  />
                </div>
                {!current && !selectedCustomer && (
                  <>
                    <div className="field">
                      <label htmlFor="booking-name">
                        {t("Name (fictional)", "Namn (påhittat)")}
                      </label>
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
                      <label htmlFor="booking-email">
                        {t("Email (fictional)", "E-post (påhittad)")}
                      </label>
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
                <section
                  className="booking-review"
                  aria-label={t("Booking summary", "Bokningssammanfattning")}
                >
                  <h3>{t("Review booking", "Kontrollera bokningen")}</h3>
                  {selectedCustomer && (
                    <p>
                      {t("Customer:", "Kund:")} {selectedCustomer.name}
                    </p>
                  )}
                  <strong>
                    {current?.serviceName ??
                      services.find((s) => s.id === serviceId)?.name}
                  </strong>
                  <p>
                    {current?.duration ??
                      services.find((s) => s.id === serviceId)?.duration}{" "}
                    min ·{" "}
                    {formatPrice(
                      current?.priceOre ??
                        services.find((s) => s.id === serviceId)?.priceOre ??
                        0,
                      locale,
                    )}{" "}
                    · {people.find((p) => p.id === staffId)?.name}
                  </p>
                  <p>
                    {readableDay(day, locale)}
                    {start
                      ? `${t(" at ", " kl. ")}${new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(start))}`
                      : t(
                          " · choose an available time",
                          " · välj en ledig tid",
                        )}
                  </p>
                </section>
                <div className="action-row">
                  <button disabled={!start}>
                    {pending
                      ? t("Saving…", "Sparar…")
                      : current
                        ? t("Save new time", "Spara flytt")
                        : t("Create booking", "Skapa bokning")}
                  </button>
                  {current && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        abandonMove();
                      }}
                    >
                      {t("Cancel", "Avbryt")}
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
        </section>
      )}
      {!current && (
        <button
          type="button"
          className="quiet-button"
          disabled={pending}
          onClick={() => {
            markClean();
            location.assign(returnHref(context, `/admin?date=${day}`));
          }}
        >
          {t("Cancel without saving", "Avbryt bokning")}
        </button>
      )}
      {message && (
        <p role="alert" className="form-error">
          {presentationError(message, locale)}{" "}
          {t("Your selections are kept.", "Dina val finns kvar.")}
        </p>
      )}
      {readError && mode === "view" && (
        <p role="alert" className="form-error">
          {presentationError(readError, locale)}
        </p>
      )}
      {status === 409 && current && (
        <button className="secondary" onClick={reload}>
          {t("Reload booking", "Läs in bokningen på nytt")}
        </button>
      )}
    </>
  );
}
