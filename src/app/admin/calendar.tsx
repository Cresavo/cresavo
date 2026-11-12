import { DateTime } from "luxon";
import { ZONE } from "@/lib/time";
import type { StaffView } from "./types";

type CalendarBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  staffId: string;
  serviceName: string;
  customerName: string;
  status: string;
};
export default function Calendar({
  date,
  view,
  staffId,
  staff,
  bookings,
  nextCursor,
  status,
}: {
  date: string;
  view: "day" | "week";
  staffId: string;
  staff: StaffView[];
  bookings: CalendarBooking[];
  nextCursor: string | null;
  status: "confirmed" | "all";
}) {
  const hourHeight = 96;
  const selected = DateTime.fromISO(date, { zone: ZONE });
  const start = view === "week" ? selected.startOf("week") : selected;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
    start.plus({ days: i }),
  );
  const knownPeople = staff.filter(
    (p) =>
      (p.active || bookings.some((b) => b.staffId === p.id)) &&
      (!staffId || p.id === staffId),
  );
  const people = [
    ...knownPeople.map((p) => ({ id: p.id, name: p.name })),
    ...[...new Set(bookings.map((b) => b.staffId))]
      .filter((id) => !knownPeople.some((p) => p.id === id))
      .map((id) => ({ id, name: "Tidigare utförare" })),
  ];
  const link = (nextDate: string, nextView = view, cursor?: string) =>
    `/admin?${new URLSearchParams({ date: nextDate, view: nextView, ...(staffId && { staffId }), ...(status === "all" && { status }), ...(cursor && { cursor }) })}`;
  const minute = (value: Date) => {
    const t = DateTime.fromJSDate(value, { zone: ZONE });
    return t.hour * 60 + t.minute;
  };
  const minHour = Math.min(
    8,
    ...bookings.map((b) => Math.floor(minute(b.startsAt) / 60)),
  );
  const maxHour = Math.max(
    18,
    ...bookings.map((b) =>
      DateTime.fromJSDate(b.endsAt, { zone: ZONE }).toISODate() !==
      DateTime.fromJSDate(b.startsAt, { zone: ZONE }).toISODate()
        ? 24
        : Math.ceil(minute(b.endsAt) / 60),
    ),
  );
  const hours = Array.from(
    { length: maxHour - minHour },
    (_, i) => minHour + i,
  );
  const time = (d: Date) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  const bookingLink = (b: CalendarBooking) =>
    `/admin/bookings/${encodeURIComponent(b.id)}`;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Bokningar</p>
          <h1>Kalender</h1>
        </div>
        <a className="button-link" href={`/admin/bookings/new?date=${date}`}>
          Ny bokning
        </a>
      </div>
      <div className="calendar-toolbar">
        <div className="date-navigation">
          <a
            className="quiet-button"
            href={link(DateTime.now().setZone(ZONE).toISODate()!)}
          >
            Idag
          </a>
          <a
            className="quiet-button desktop-navigation"
            aria-label={view === "week" ? "Föregående vecka" : "Föregående dag"}
            href={link(
              selected.minus({ days: view === "week" ? 7 : 1 }).toISODate()!,
            )}
          >
            ←
          </a>
          <a
            className="quiet-button desktop-navigation"
            aria-label={view === "week" ? "Nästa vecka" : "Nästa dag"}
            href={link(
              selected.plus({ days: view === "week" ? 7 : 1 }).toISODate()!,
            )}
          >
            →
          </a>
          <a
            className="quiet-button mobile-navigation"
            aria-label="Föregående dag"
            href={link(selected.minus({ days: 1 }).toISODate()!, "day")}
          >
            ←
          </a>
          <a
            className="quiet-button mobile-navigation"
            aria-label="Nästa dag"
            href={link(selected.plus({ days: 1 }).toISODate()!, "day")}
          >
            →
          </a>
          <strong>
            {view === "week"
              ? `Vecka ${selected.weekNumber} · ${start.toFormat("d MMM", { locale: "sv" })}–${start.plus({ days: 6 }).toFormat("d MMM", { locale: "sv" })}`
              : selected.toFormat("cccc d MMMM", { locale: "sv" })}
          </strong>
        </div>
        <form method="get" className="calendar-filters">
          <input type="hidden" name="view" value={view} />
          <div>
            <label htmlFor="calendar-date">Datum</label>
            <input
              id="calendar-date"
              name="date"
              type="text"
              lang="sv-SE"
              placeholder="YYYY-MM-DD"
              pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
              defaultValue={date}
              required
            />
          </div>
          <div>
            <label htmlFor="calendar-staff">Medarbetare</label>
            <select id="calendar-staff" name="staffId" defaultValue={staffId}>
              <option value="">Alla</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.active ? " (inaktiv)" : ""}
                </option>
              ))}
            </select>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              name="status"
              value="all"
              defaultChecked={status === "all"}
            />
            Visa avbokade
          </label>
          <button className="secondary">Visa</button>
        </form>
        <div className="calendar-views" aria-label="Kalendervy">
          <a
            className={view === "day" ? "selected" : ""}
            href={link(date, "day")}
          >
            Dag
          </a>
          <a
            className={view === "week" ? "selected" : ""}
            href={link(date, "week")}
          >
            Vecka
          </a>
        </div>
      </div>
      <div className="mobile-calendar" aria-label="Dagens bokningar">
        {days.map((day) => {
          const items = bookings.filter(
            (b) =>
              DateTime.fromJSDate(b.startsAt, { zone: ZONE }).toISODate() ===
              day.toISODate(),
          );
          return (
            <section key={day.toISODate()}>
              {view === "week" && (
                <h2>{day.toFormat("cccc d MMMM", { locale: "sv" })}</h2>
              )}
              {!items.length ? (
                <p className="empty-state">
                  Inga bokningar {view === "week" ? "den här dagen" : "ännu"}.
                </p>
              ) : (
                items.map((b) => (
                  <a
                    className={`mobile-booking ${b.status === "cancelled" ? "cancelled" : ""}`}
                    key={b.id}
                    href={bookingLink(b)}
                  >
                    <strong>
                      {time(b.startsAt)}–{time(b.endsAt)}
                    </strong>
                    <span>{b.serviceName}</span>
                    <span>
                      {b.customerName} ·{" "}
                      {staff.find((p) => p.id === b.staffId)?.name ??
                        "Tidigare medarbetare"}
                    </span>
                    {b.status === "cancelled" && <span>Avbokad</span>}
                  </a>
                ))
              )}
            </section>
          );
        })}
      </div>
      <div
        className="desktop-calendar"
        role="region"
        aria-label={view === "week" ? "Veckokalender" : "Dagkalender"}
        tabIndex={0}
      >
        <div
          className="calendar-grid"
          style={{
            gridTemplateColumns: `52px repeat(${days.length}, minmax(${view === "week" ? "135px" : "230px"}, 1fr))`,
          }}
        >
          <div className="calendar-axis-heading">Tid</div>
          {days.map((day) => (
            <div className="calendar-day-heading" key={day.toISODate()}>
              <a href={link(day.toISODate()!, "day")}>
                {day.toFormat("ccc d/M", { locale: "sv" })}
              </a>
              <div className="staff-headings">
                {people.map((p) => (
                  <span key={p.id}>{p.name}</span>
                ))}
              </div>
            </div>
          ))}
          <div
            className="calendar-axis"
            style={{ height: hours.length * hourHeight }}
          >
            {hours.map((h) => (
              <span key={h} style={{ top: (h - minHour) * hourHeight }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div
              className="calendar-day"
              key={day.toISODate()}
              style={{ height: hours.length * hourHeight }}
            >
              {hours.map((h) => (
                <div
                  className="hour-line"
                  key={h}
                  style={{ top: (h - minHour) * hourHeight }}
                />
              ))}
              {bookings
                .filter(
                  (b) =>
                    b.status === "confirmed" &&
                    DateTime.fromJSDate(b.startsAt, {
                      zone: ZONE,
                    }).toISODate() === day.toISODate(),
                )
                .map((b) => {
                  const lane = Math.max(
                      0,
                      people.findIndex((p) => p.id === b.staffId),
                    ),
                    lanes = Math.max(1, people.length);
                  const endMinute =
                    DateTime.fromJSDate(b.endsAt, {
                      zone: ZONE,
                    }).toISODate() !== day.toISODate()
                      ? 1440
                      : minute(b.endsAt);
                  return (
                    <a
                      key={b.id}
                      href={bookingLink(b)}
                      className={`calendar-booking ${b.status === "cancelled" ? "cancelled" : ""}`}
                      style={{
                        top:
                          ((minute(b.startsAt) - minHour * 60) / 60) *
                          hourHeight,
                        height: Math.max(
                          44,
                          ((endMinute - minute(b.startsAt)) / 60) * hourHeight,
                        ),
                        left: `calc(${(lane / lanes) * 100}% + 3px)`,
                        width: `calc(${100 / lanes}% - 6px)`,
                      }}
                      title={`${time(b.startsAt)}–${time(b.endsAt)} ${b.serviceName} · ${b.customerName}`}
                    >
                      <strong>
                        {time(b.startsAt)}–{time(b.endsAt)}
                      </strong>
                      <span>{b.serviceName}</span>
                      <span>{b.customerName}</span>
                      {b.status === "cancelled" && <span>Avbokad</span>}
                    </a>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      {!bookings.filter((b) => b.status === "confirmed").length && (
        <p className="desktop-empty">
          Inga aktiva bokningar i den valda perioden.
        </p>
      )}
      {status === "all" && bookings.some((b) => b.status === "cancelled") && (
        <section className="desktop-cancellations panel">
          <h2>Avbokade bokningar</h2>
          <ul className="event-list">
            {bookings
              .filter((b) => b.status === "cancelled")
              .map((b) => (
                <li key={b.id}>
                  <a href={bookingLink(b)}>
                    {DateTime.fromJSDate(b.startsAt, { zone: ZONE }).toFormat(
                      "d/M HH:mm",
                    )}{" "}
                    · {b.serviceName} · {b.customerName}
                  </a>
                </li>
              ))}
          </ul>
        </section>
      )}
      {nextCursor && (
        <p className="pagination-notice">
          Visar högst 100 bokningar per sida.{" "}
          <a href={link(date, view, nextCursor)}>Nästa sida med bokningar</a>
        </p>
      )}
    </>
  );
}
