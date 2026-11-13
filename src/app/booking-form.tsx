"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { formatPrice, readableDay } from "@/lib/format";
import DatePicker from "./components/date-picker";
import SlotPicker from "./components/slot-picker";
import { useAvailability } from "./components/use-availability";
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
          `${service?.name} · ${service?.duration} min · ${formatPrice(service?.priceOre ?? 0)} · ${person?.name} · ${readableDay(date)} kl. ${time(start)}`,
        );
      } else {
        setMessage(
          result.error === "Tiden är inte tillgänglig"
            ? "Tiden är inte längre tillgänglig. Välj en annan ledig tid."
            : (result.error ?? "Bokningen kunde inte sparas. Försök igen."),
        );
        setStale(response.status === 409);
        if (response.status === 400 || response.status === 409) {
          setStart("");
          availability.refresh();
        }
      }
    } catch {
      setMessage("Svaret kunde inte hämtas. Försök igen med samma uppgifter.");
    } finally {
      setPending(false);
    }
  }
  if (success)
    return (
      <section className="booking-success" role="status">
        <span className="eyebrow">Bokningsbekräftelse</span>
        <h2 ref={confirmationHeading} tabIndex={-1}>
          Din bokning är klar
        </h2>
        <p>Din testbokning är registrerad.</p>
        <p className="confirmation-summary">{success}</p>
        <p>Detta är en demo. Inga mejl eller SMS skickas.</p>
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
          Boka en ny tid
        </button>
      </section>
    );
  if (!services.length || !staff.length)
    return (
      <p className="empty-state">
        Det finns inga bokningsbara behandlingar just nu. Salongen behöver
        aktivera behandling och personal i arbetsytan.
      </p>
    );
  return (
    <form onSubmit={book} className="customer-booking">
      <div className="booking-step">
        <h2>
          <span>1</span> Behandling och utförare
        </h2>
        <label htmlFor="service">Behandling</label>
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
              {s.name} · {s.duration} min · {formatPrice(s.priceOre)}
            </option>
          ))}
        </select>
        <label htmlFor="staff">Medarbetare</label>
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
          <option value="">Välj medarbetare</option>
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
          <span>2</span> Dag och tid
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
          <p role="status">Hämtar lediga tider…</p>
        ) : availability.error ? (
          <div role="alert" className="form-error">
            <p>{availability.error}</p>
            <button
              type="button"
              className="secondary"
              onClick={availability.refresh}
            >
              Försök hämta tider igen
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
            <strong>Inga lediga tider {readableDay(date)}.</strong>
            <p>
              Det kan vara stängt eller fullbokat. Välj en annan dag, behandling
              eller medarbetare.
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
            ? "Letar efter en ledig dag…"
            : "Hitta nästa lediga dag"}
        </button>
      </div>
      <div className="booking-step">
        <h2>
          <span>3</span> Dina uppgifter och bokning
        </h2>
        <label htmlFor="name">Namn (påhittat)</label>
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
        <label htmlFor="email">E-post (påhittad)</label>
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
          Använd en testadress, till exempel kund@example.test. Inga utskick
          görs.
        </p>
        <section className="booking-review" aria-label="Din bokning">
          <h3>Din bokning</h3>
          <strong>{service?.name}</strong>
          <p>
            {service?.duration} min · {formatPrice(service?.priceOre ?? 0)} ·{" "}
            {person?.name}
          </p>
          <p>
            {readableDay(date)}
            {start ? ` kl. ${time(start)}` : " · välj en ledig tid ovan"}
          </p>
        </section>
        {message && (
          <p role="alert" className="form-error">
            {message}
            {/[.!?]$/.test(message) ? "" : "."} Dina uppgifter finns kvar.
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
            Uppdatera behandlingar och priser
          </button>
        )}
        <button type="submit" disabled={!hydrated || pending || !start}>
          {pending ? "Bokar…" : "Bekräfta testbokning"}
        </button>
      </div>
    </form>
  );
}
