"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { formatPrice, readableDay } from "@/lib/format";
import DatePicker from "./components/date-picker";
import SlotPicker from "./components/slot-picker";
import { useAvailability } from "./components/use-availability";
import { useLocale } from "./components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
import { DemoConfirmation } from "./demo-confirmation";
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
  readOnly = false,
  demoSalon,
  agentDemo = false,
  presentationOnly = false,
  services,
  staff,
  initialService,
  initialStaff,
  initialDate,
  initialSlot,
}: {
  readOnly?: boolean;
  demoSalon?: string;
  agentDemo?: boolean;
  presentationOnly?: boolean;
  services: Service[];
  staff: Staff[];
  initialService?: string;
  initialStaff?: string;
  initialDate?: string;
  initialSlot?: string;
}) {
  const prefix = useId();
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
  const [serviceId, setService] = useState(
      services.find((s) => s.id === initialService)?.id ??
        services[0]?.id ??
        "",
    ),
    [staffId, setStaff] = useState(
      staff.find(
        (p) => p.id === initialStaff && p.serviceIds.includes(serviceId),
      )?.id ??
        staff.find((p) => p.serviceIds.includes(serviceId))?.id ??
        "",
    );
  const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!,
    last = DateTime.fromISO(today).plus({ days: 60 }).toISODate()!;
  const [date, setDate] = useState(
      initialDate &&
        DateTime.fromISO(initialDate).toISODate() === initialDate &&
        initialDate >= today &&
        initialDate <= last
        ? initialDate
        : today,
    ),
    [requestedStart, setStart] = useState(initialSlot ?? ""),
    [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);
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
  const availability = useAvailability(presentationOnly ? "" : serviceId, staffId, date);
  const slots = presentationOnly
    ? ["10:00", "11:30", "14:00"].map((hour) => DateTime.fromISO(`${date}T${hour}`, { zone: "Europe/Stockholm" }).toUTC().toISO()!)
    : availability.slots;
  const start = slots.includes(requestedStart)
    ? requestedStart
    : "";
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
    if (readOnly || !start || pending) return;
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
          result.error === "That time is no longer available. Choose another time."
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
        <section data-testid="simulated-payment" className="payment-step" aria-label={t("Simulated prepayment", "Simulerad förskottsbetalning")}>
          <h3>{t("Simulated prepayment", "Simulerad förskottsbetalning")}</h3>
          <p>{t("Separate from booking confirmation. No payment details are collected and no money is charged.", "Separat från bokningsbekräftelsen. Inga betaluppgifter samlas in och inga pengar dras.")}</p>
          <button type="button" data-testid="simulated-payment-confirm" disabled={paymentComplete} onClick={() => setPaymentComplete(true)}>{t("Simulate payment token", "Simulera betalningstoken")}</button>
          {paymentComplete && <p role="status">{t("Fictional token simulated for this visit. No real payment.", "Påhittat token simulerat för detta besök. Ingen riktig betalning.")}</p>}
        </section>
        <Link href={"/admin?" + new URLSearchParams({ date, view: "day", staffId })}>
          {t("See this time in the demo calendar", "Se tiden i demokalendern")}
        </Link>
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
            setPaymentComplete(false);
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
      {readOnly && <p id={prefix + "-readonly"} className="muted">{t("Read-only simulation. Contact fields and booking submission are disabled. Choose a time to explore the local demo.", "Simulering i läsläge. Kontaktfält och bokningssändning är avstängda. Välj en tid för att utforska den lokala demon.")}</p>}
      <div className="booking-step">
        <h2>
          <span>1</span> {t("Treatment and person", "Behandling och utförare")}
        </h2>
        <label htmlFor={prefix + "-service"}>{t("Treatment", "Behandling")}</label>
        <select
          id={prefix + "-service"}
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
        <label htmlFor={prefix + "-staff"}>{t("Team member", "Medarbetare")}</label>
        <select
          id={prefix + "-staff"}
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
          id={prefix + "-date"}
          value={date}
          min={today}
          max={last}
          onChange={chooseDay}
          disabled={!hydrated || pending}
        />
        <p className="muted">{service?.duration} min · {formatPrice(service?.priceOre ?? 0, locale)}</p>
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
        ) : slots.length ? (
          <SlotPicker
            id={prefix + "-slot"}
            slots={slots}
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
        {!presentationOnly && !agentDemo && <button
          type="button"
          className="secondary next-available"
          disabled={pending || availability.finding || !staffId}
          onClick={() => void availability.next(chooseDay)}
        >
          {availability.finding
            ? t("Finding the next available day…", "Letar efter en ledig dag…")
            : t("Find the next available day", "Hitta nästa lediga dag")}
        </button>}
      </div>
      <div className="booking-step">
        <h2>
          <span>3</span>{" "}
          {agentDemo ? t("Review the proposal", "Granska förslaget") : t("Your details and booking", "Dina uppgifter och bokning")}
        </h2>
        {!agentDemo && <>
        <label htmlFor={prefix + "-name"}>{t("Name (fictional)", "Namn (påhittat)")}</label>
        <input
          id={prefix + "-name"}
          name="name"
          required
          minLength={2}
          maxLength={80}
          disabled={readOnly}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor={prefix + "-email"}>
          {t("Email (fictional)", "E-post (påhittad)")}
        </label>
        <input
          id={prefix + "-email"}
          name="email"
          type="email"
          required
          maxLength={254}
          disabled={readOnly}
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
        </>}
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
        {!agentDemo && <button
          type="submit"
          disabled={readOnly || !hydrated || pending || !start}
          aria-describedby={readOnly ? prefix + "-readonly" : undefined}
        >
          {pending
            ? t("Booking…", "Bokar…")
            : t("Confirm demo booking", "Bekräfta testbokning")}
        </button>}
        {readOnly && demoSalon && start && service && person && <DemoConfirmation
          key={JSON.stringify([demoSalon, serviceId, staffId, date, start])}
          agent={agentDemo}
          booking={{ salon: demoSalon, serviceId, treatment: service.name, duration: service.duration,
            priceOre: service.priceOre, staffId, person: person.name, day: date, start }}
        />}
      </div>
    </form>
  );
}
