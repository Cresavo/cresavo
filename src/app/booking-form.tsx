"use client";
import { formatBookingTime } from "@/lib/format";
import { useRef, useState, useSyncExternalStore } from "react";
const subscribe = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;
type Service = { id: string; name: string; version?: number };
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
    hydratedSnapshot,
    serverSnapshot,
  );
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const searchVersion = useRef(0);
  const [staffId, setStaff] = useState(
    staff.find((p) => p.serviceIds.includes(services[0]?.id))?.id ?? "",
  );
  const [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState("");
  const [searching, setSearching] = useState(false),
    [pending, setPending] = useState(false),
    [staleService, setStaleService] = useState(false);
  const [serviceId, setService] = useState(services[0]?.id ?? ""),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [start, setStart] = useState(""),
    [message, setMessage] = useState("");
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setStart("");
    const version = ++searchVersion.current;
    setSearching(true);
    setSlots([]);
    try {
      const query = new URLSearchParams({ serviceId, staffId, date });
      const r = await fetch(`/api/availability?${query}`, {
        cache: "no-store",
      });
      const data = await r.json();
      if (version !== searchVersion.current) return;
      if (!r.ok) setMessage(data.error);
      else {
        setSlots(data);
        if (!data.length) setMessage("Inga lediga tider detta datum.");
      }
    } catch {
      if (version === searchVersion.current)
        setMessage("Tiderna kunde inte hämtas. Försök igen.");
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  }
  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = JSON.stringify({
      serviceId,
      staffId,
      serviceVersion: services.find((s) => s.id === serviceId)?.version,
      start,
      customerName: form.get("name"),
      customerEmail: form.get("email"),
    });
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    const key = submission.current.key;
    setPending(true);
    setStaleService(false);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: payload,
      });
      const data = await r.json();
      if (r.ok) {
        setMessage(
          `Din testbokning är registrerad. ${services.find((s) => s.id === serviceId)?.name} · ${formatBookingTime(start)} (Europe/Stockholm)`,
        );
        setSlots([]);
        setStart("");
      } else {
        setMessage(data.error);
        setStaleService(r.status === 409);
      }
    } catch {
      // Preserve the key: the server may have committed before the connection failed.
      setMessage("Svaret kunde inte hämtas. Försök igen med samma uppgifter.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={search} className="space-y-4">
        <div>
          <label htmlFor="service">Behandling</label>
          <select
            disabled={!hydrated || pending}
            id="service"
            value={serviceId}
            onChange={(e) => {
              setService(e.target.value);
              setStaff(
                staff.find((p) => p.serviceIds.includes(e.target.value))?.id ??
                  "",
              );
              searchVersion.current++;
              setSearching(false);
              setSlots([]);
              setStart("");
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="staff">Medarbetare</label>
          <select
            id="staff"
            value={staffId}
            disabled={!hydrated || pending}
            required
            onChange={(e) => {
              setStaff(e.target.value);
              searchVersion.current++;
              setSearching(false);
              setSlots([]);
              setStart("");
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
        <div>
          <label htmlFor="date">Datum</label>
          <input
            disabled={!hydrated || pending}
            id="date"
            type="text"
            placeholder="YYYY-MM-DD"
            pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
            lang="sv-SE"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              searchVersion.current++;
              setSearching(false);
              setSlots([]);
              setStart("");
            }}
          />
        </div>
        <button
          disabled={!hydrated || searching || pending || !staffId}
          type="submit"
        >
          {searching ? "Hämtar tider…" : "Visa lediga tider"}
        </button>
      </form>
      {slots.length > 0 && (
        <form onSubmit={book} className="space-y-4 mt-6 border-t pt-5">
          <div>
            <label htmlFor="slot">Ledig tid</label>
            <select
              id="slot"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            >
              <option value="">Välj tid</option>
              {slots.map((s) => (
                <option value={s} key={s}>
                  {new Intl.DateTimeFormat("sv-SE", {
                    timeZone: "Europe/Stockholm",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(s))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="name">Namn (påhittat)</label>
            <input
              id="name"
              name="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          </div>
          <div>
            <label htmlFor="email">E-post (påhittad)</label>
            <input
              id="email"
              name="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              type="email"
              maxLength={254}
              required
            />
          </div>
          <button type="submit" disabled={pending}>
            {pending ? "Bokar…" : "Bekräfta testbokning"}
          </button>
        </form>
      )}
      <p aria-live="polite" className="mt-4">
        {message}
      </p>
      {staleService && (
        <button className="secondary" onClick={() => window.location.reload()}>
          Uppdatera behandlingar och priser
        </button>
      )}
    </>
  );
}
