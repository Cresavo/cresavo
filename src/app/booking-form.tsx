"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { formatPrice, readableDay } from "@/lib/format";
import DatePicker from "./components/date-picker";
import SlotPicker from "./components/slot-picker";
import { useAvailability } from "./components/use-availability";
import { useLocale } from "./components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
const subscribe = () => () => {};
type Service = {
  id: string;
  name: string;
  duration: number;
  priceOre: number;
  version?: number;
};
type Staff = { id: string; name: string; serviceIds: string[] };
export default function BookingForm({
  services,
  staff,
}: {
  services: Service[];
  staff: Staff[];
}) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const hydrated = useSyncExternalStore(
      subscribe,
      () => true,
      () => false,
    ),
    router = useRouter();
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const serviceSelect = useRef<HTMLSelectElement>(null);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const [serviceId, setService] = useState(services[0]?.id ?? ""),
    [staffId, setStaff] = useState(
      staff.find((p) => p.serviceIds.includes(services[0]?.id))?.id ?? "",
    );
  const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!,
    last = DateTime.fromISO(today).plus({ days: 60 }).toISODate()!;
  const [date, setDate] = useState(today),
    [start, setStart] = useState(""),
    [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState("");
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [stale, setStale] = useState(false),
    [success, setSuccess] = useState("");
  useEffect(() => {
    if (success) {
      confirmationHeading.current?.focus();
      confirmationHeading.current?.scrollIntoView({ block: "center" });
    }
  }, [success]);
  const availability = useAvailability(serviceId, staffId, date);
  const service = services.find((s) => s.id === serviceId),
    person = staff.find((s) => s.id === staffId);
  const time = (value: string) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const chooseDay = (value: string) => {
    setDate(value);
    setStart("");
    setMessage("");
  };
  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start || pending) return;
    const payload = JSON.stringify({
      serviceId,
      staffId,
      serviceVersion: service?.version,
      start,
      customerName,
      customerEmail,
    });
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    setStale(false);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": submission.current.key,
        },
        body: payload,
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess(
          `${service?.name} · ${service?.duration} min · ${formatPrice(service?.priceOre ?? 0, locale)} · ${person?.name} · ${readableDay(date, locale)}${t(" at ", " kl. ")}${time(start)} (Stockholm)`,
        );
      } else {
        setMessage(
          result.error === "Tiden är inte tillgänglig"
            ? t(
                "That time is no longer available. Choose another time.",
                "Tiden är inte längre tillgänglig. Välj en annan ledig tid.",
              )
            : presentationError(result.error, locale),
        );
        setStale(response.status === 409);
        if (response.status === 400 || response.status === 409) {
          setStart("");
          availability.refresh();
        }
      }
    } catch {
      setMessage(
        t(
          "The response was lost. Retry with the same details.",
          "Svaret kunde inte hämtas. Försök igen med samma uppgifter.",
        ),
      );
    } finally {
      setPending(false);
    }
  }
  if (success)
    return (
      <section className="booking-success" role="status">
        <span className="eyebrow">
          {t("Booking confirmation", "Bokningsbekräftelse")}
        </span>
        <h2 ref={confirmationHeading} tabIndex={-1}>
          {t("Your booking is confirmed", "Din bokning är klar")}
        </h2>
        <p>
          {t(
            "Your demo booking has been saved.",
            "Din testbokning är registrerad.",
          )}
        </p>
        <p className="confirmation-summary">{success}</p>
        <p>
          {t(
            "This is a demo. No emails or text messages are sent.",
            "Detta är en demo. Inga mejl eller SMS skickas.",
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setSuccess("");
            setStart("");
            submission.current = null;
            availability.refresh();
            requestAnimationFrame(() => serviceSelect.current?.focus());
          }}
        >
          {t("Book another visit", "Boka en ny tid")}
        </button>
      </section>
    );
  if (!services.length || !staff.length)
    return (
      <p className="empty-state">
        {t(
          "No treatments are available to book yet. Services and staff need to be activated in the workspace.",
          "Det finns inga bokningsbara behandlingar just nu. Salongen behöver aktivera behandling och personal i arbetsytan.",
        )}
      </p>
    );
  return (
    <form onSubmit={book} className="customer-booking">
      <div className="booking-step">
        <h2>
          <span>1</span> {t("Treatment and person", "Behandling och utförare")}
        </h2>
        <label htmlFor="service">{t("Treatment", "Behandling")}</label>
        <select
          id="service"
          ref={serviceSelect}
          disabled={!hydrated || pending}
          value={serviceId}
          onChange={(e) => {
            setService(e.target.value);
            setStaff(
              staff.find((p) => p.serviceIds.includes(e.target.value))?.id ??
                "",
            );
            setStart("");
            setMessage("");
          }}
        >
          {services.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name} · {s.duration} min · {formatPrice(s.priceOre, locale)}
            </option>
          ))}
        </select>
        <label htmlFor="staff">{t("Team member", "Medarbetare")}</label>
        <select
          id="staff"
          disabled={!hydrated || pending}
          required
          value={staffId}
          onChange={(e) => {
            setStaff(e.target.value);
            setStart("");
            setMessage("");
          }}
        >
          <option value="">
            {t("Choose a team member", "Välj medarbetare")}
          </option>
          {staff
            .filter((p) => p.serviceIds.includes(serviceId))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>
      <div className="booking-step">
        <h2>
          <span>2</span> {t("Day and time", "Dag och tid")}
        </h2>
        <DatePicker
          id="date"
          value={date}
          min={today}
          max={last}
          onChange={chooseDay}
          disabled={!hydrated || pending}
        />
        {availability.loading ? (
          <p role="status">
            {t("Finding available times…", "Hämtar lediga tider…")}
          </p>
        ) : availability.error ? (
          <div role="alert" className="form-error">
            <p>{presentationError(availability.error, locale)}</p>
            <button
              type="button"
              className="secondary"
              onClick={availability.refresh}
            >
              {t("Try loading times again", "Försök hämta tider igen")}
            </button>
          </div>
        ) : availability.slots.length ? (
          <SlotPicker
            id="slot"
            slots={availability.slots}
            value={start}
            onChange={setStart}
            disabled={pending}
          />
        ) : (
          <div className="empty-state">
            <strong>
              {t("No available times on", "Inga lediga tider")}{" "}
              {readableDay(date, locale)}.
            </strong>
            <p>
              {t(
                "This day may be closed or fully booked. Try another day, treatment or team member.",
                "Det kan vara stängt eller fullbokat. Välj en annan dag, behandling eller medarbetare.",
              )}
            </p>
          </div>
        )}
        <button
          type="button"
          className="secondary next-available"
          disabled={pending || availability.finding || !staffId}
          onClick={() => void availability.next(chooseDay)}
        >
          {availability.finding
            ? t("Finding the next available day…", "Letar efter en ledig dag…")
            : t("Find the next available day", "Hitta nästa lediga dag")}
        </button>
      </div>
      <div className="booking-step">
        <h2>
          <span>3</span>{" "}
          {t("Your details and booking", "Dina uppgifter och bokning")}
        </h2>
        <label htmlFor="name">{t("Name (fictional)", "Namn (påhittat)")}</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor="email">
          {t("Email (fictional)", "E-post (påhittad)")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          autoComplete="off"
        />
        <p className="muted">
          {t(
            "Use a test address, such as guest@example.test. No messages are sent.",
            "Använd en testadress, till exempel kund@example.test. Inga utskick görs.",
          )}
        </p>
        <section
          className="booking-review"
          aria-label={t("Your booking", "Din bokning")}
        >
          <h3>{t("Your booking", "Din bokning")}</h3>
          <strong>{service?.name}</strong>
          <p>
            {service?.duration} min ·{" "}
            {formatPrice(service?.priceOre ?? 0, locale)} · {person?.name}
          </p>
          <p>
            {readableDay(date, locale)}
            {start
              ? `${t(" at ", " kl. ")}${time(start)} (Stockholm)`
              : t(
                  " · choose an available time above",
                  " · välj en ledig tid ovan",
                )}
          </p>
        </section>
        {message && (
          <p role="alert" className="form-error">
            {message}
            {/[.!?]$/.test(message) ? "" : "."}{" "}
            {t("Your details are still here.", "Dina uppgifter finns kvar.")}
          </p>
        )}
        {stale && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              router.refresh();
              availability.refresh();
              setStale(false);
            }}
          >
            {t(
              "Refresh treatments and prices",
              "Uppdatera behandlingar och priser",
            )}
          </button>
        )}
        <button type="submit" disabled={!hydrated || pending || !start}>
          {pending
            ? t("Booking…", "Bokar…")
            : t("Confirm demo booking", "Bekräfta testbokning")}
        </button>
      </div>
    </form>
  );
}
