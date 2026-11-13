import { DateTime } from "luxon";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { ZONE } from "@/lib/time";
import { readableDay } from "@/lib/format";
import type { StaffView } from "./types";
import CalendarFilters from "./calendar-filters";
import ContextLink from "../components/context-link";
import { contextualHref, type ReturnContext } from "@/lib/navigation-context";

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
  context = {},
}: {
  date: string;
  view: "day" | "week";
  staffId: string;
  staff: StaffView[];
  bookings: CalendarBooking[];
  nextCursor: string | null;
  status: "confirmed" | "all";
  context?: ReturnContext;
}) {
  const hourHeight = 144;
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
    contextualHref(
      `/admin?${new URLSearchParams({ date: nextDate, view: nextView, ...(staffId && { staffId }), ...(status === "all" && { status }), ...(cursor && { cursor }) })}`,
      context,
    );
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
          <p className="eyebrow">Salongens arbetsdag</p>
          <h1>Kalender</h1>
        </div>
        <ContextLink
          className="button-link"
          href={`/admin/bookings/new?date=${date}${staffId ? `&staff=${encodeURIComponent(staffId)}` : ""}`}
        >
          <Plus size={18} aria-hidden="true" />
          Ny bokning
        </ContextLink>
      </div>
      <div className="workspace-guidance calendar-guidance">
        <details>
          <summary>Så använder du kalendern</summary>
          <p>
            Öppna ett bokningskort för att flytta eller avboka. Välj Ny bokning
            för att hitta en ledig tid åt en kund.
          </p>
        </details>
        {date === DateTime.now().setZone(ZONE).toISODate() && (
          <p>
            <strong>
              {bookings.filter((b) => b.status === "confirmed").length}
              {nextCursor ? " +" : ""} bokningar i den visade perioden.
            </strong>{" "}
            {(() => {
              const next = bookings.find(
                (b) =>
                  b.status === "confirmed" &&
                  b.startsAt.getTime() >= Date.now(),
              );
              return next ? (
                <ContextLink href={bookingLink(next)}>
                  Nästa besök:{" "}
                  {readableDay(
                    DateTime.fromJSDate(next.startsAt, {
                      zone: ZONE,
                    }).toISODate()!,
                  )}{" "}
                  kl. {time(next.startsAt)} · {next.customerName} ·{" "}
                  {next.serviceName}
                </ContextLink>
              ) : (
                "Inga fler kommande besök i den visade perioden."
              );
            })()}
          </p>
        )}
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
            <ChevronLeft size={18} aria-hidden="true" />
          </a>
          <a
            className="quiet-button desktop-navigation"
            aria-label={view === "week" ? "Nästa vecka" : "Nästa dag"}
            href={link(
              selected.plus({ days: view === "week" ? 7 : 1 }).toISODate()!,
            )}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </a>
          <a
            className="quiet-button mobile-navigation"
            aria-label="Föregående dag"
            href={link(selected.minus({ days: 1 }).toISODate()!, "day")}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </a>
          <a
            className="quiet-button mobile-navigation"
            aria-label="Nästa dag"
            href={link(selected.plus({ days: 1 }).toISODate()!, "day")}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </a>
          <strong>
            {view === "week"
              ? `Vecka ${selected.weekNumber} · ${start.toFormat("d MMM", { locale: "sv" })}–${start.plus({ days: 6 }).toFormat("d MMM", { locale: "sv" })}`
              : selected.toFormat("cccc d MMMM", { locale: "sv" })}
          </strong>
        </div>
        <CalendarFilters
          date={date}
          href={link(date)}
          staffId={staffId}
          staff={staff.map(({ id, name, active }) => ({ id, name, active }))}
          status={status}
        />
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
                  Inga bokningar {view === "week" ? "den här dagen" : "ännu"}.{" "}
                  <ContextLink
                    href={`/admin/bookings/new?date=${day.toISODate()}`}
                  >
                    Lägg in en bokning eller sök lediga tider.
                  </ContextLink>
                </p>
              ) : (
                items.map((b) => (
                  <ContextLink
                    data-tone={
                      Math.max(
                        0,
                        staff.findIndex((p) => p.id === b.staffId),
                      ) % 4
                    }
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
                  </ContextLink>
                ))
              )}
            </section>
          );
        })}
      </div>
      {view === "week" && people.length > 1 && (
        <p className="desktop-calendar-help muted" id="calendar-help">
          Välj en medarbetare för en samlad veckoöverblick. Med alla medarbetare
          kan du rulla kalendern i sidled eller trycka på en dag för dagvyn.
        </p>
      )}
      <div
        className="desktop-calendar"
        data-calendar-scroll
        role="region"
        aria-label={view === "week" ? "Veckokalender" : "Dagkalender"}
        aria-describedby={
          view === "week" && people.length > 1 ? "calendar-help" : undefined
        }
        tabIndex={0}
      >
        <div
          className="calendar-grid"
          style={{
            gridTemplateColumns: `52px repeat(${days.length}, minmax(${Math.max(view === "week" ? 160 : 230, people.length * 160 + 8)}px, 1fr))`,
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
                  <span
                    key={p.id}
                    data-tone={
                      Math.max(
                        0,
                        staff.findIndex((person) => person.id === p.id),
                      ) % 4
                    }
                  >
                    {p.name}
                  </span>
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
                    <ContextLink
                      key={b.id}
                      href={bookingLink(b)}
                      data-tone={
                        Math.max(
                          0,
                          staff.findIndex((p) => p.id === b.staffId),
                        ) % 4
                      }
                      data-compact={
                        endMinute - minute(b.startsAt) < 25 ? "true" : undefined
                      }
                      aria-label={`${time(b.startsAt)}–${time(b.endsAt)} · ${b.serviceName} · ${b.customerName}`}
                      className={`calendar-booking ${b.status === "cancelled" ? "cancelled" : ""}`}
                      style={{
                        top:
                          ((minute(b.startsAt) - minHour * 60) / 60) *
                          hourHeight,
                        height: Math.max(
                          10,
                          ((endMinute - minute(b.startsAt)) / 60) * hourHeight -
                            2,
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
                    </ContextLink>
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
                  <ContextLink href={bookingLink(b)}>
                    {DateTime.fromJSDate(b.startsAt, { zone: ZONE }).toFormat(
                      "d/M HH:mm",
                    )}{" "}
                    · {b.serviceName} · {b.customerName}
                  </ContextLink>
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
