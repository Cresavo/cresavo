"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffView, ServiceView } from "../types";
import type { Weekly, Exceptions } from "@/lib/schedule";
import { useWrite, useUnsavedChanges } from "../use-write";
import DatePicker from "../../components/date-picker";
import { readableDay } from "@/lib/format";

type Period = { start: string; end: string };
const weekdays = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];
function Periods({
  label,
  prefix,
  rows,
  onChange,
}: {
  label: string;
  prefix: string;
  rows: Period[];
  onChange: (rows: Period[]) => void;
}) {
  const nextStart =
    rows.at(-1)?.end ?? (label === "Pauser" ? "12:00" : "09:00");
  const [hour, minute] = nextStart.split(":").map(Number);
  const nextEndMinutes = Math.min(1440, hour * 60 + minute + 60);
  const nextEnd = `${String(Math.floor(nextEndMinutes / 60)).padStart(2, "0")}:${String(nextEndMinutes % 60).padStart(2, "0")}`;
  return (
    <div className="periods">
      <h4>{label}</h4>
      {rows.map((row, index) => (
        <div className="period-row" key={index}>
          <div>
            <label htmlFor={`${prefix}-${index}-start`}>Från</label>
            <input
              id={`${prefix}-${index}-start`}
              list="schedule-times"
              value={row.start}
              placeholder="09:00"
              pattern="[0-9]{2}:[0-9]{2}"
              required
              onChange={(e) =>
                onChange(
                  rows.map((p, i) =>
                    i === index ? { ...p, start: e.target.value } : p,
                  ),
                )
              }
            />
          </div>
          <div>
            <label htmlFor={`${prefix}-${index}-end`}>Till</label>
            <input
              id={`${prefix}-${index}-end`}
              list="schedule-times"
              value={row.end}
              placeholder="17:00"
              pattern="[0-9]{2}:[0-9]{2}"
              required
              onChange={(e) =>
                onChange(
                  rows.map((p, i) =>
                    i === index ? { ...p, end: e.target.value } : p,
                  ),
                )
              }
            />
          </div>
          <button
            type="button"
            className="quiet-button"
            aria-label={`Ta bort ${label.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            Ta bort
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary small-button"
        disabled={
          rows.length >= 8 ||
          !Number.isFinite(nextEndMinutes) ||
          nextStart >= "24:00"
        }
        onClick={() =>
          onChange([
            ...rows,
            {
              start: nextStart,
              end: rows.length
                ? nextEnd
                : label === "Pauser"
                  ? "13:00"
                  : "17:00",
            },
          ])
        }
      >
        Lägg till {label === "Pauser" ? "paus" : "arbetspass"}
      </button>
    </div>
  );
}
export default function StaffEditor({
  staff,
  services,
}: {
  staff?: StaffView;
  services: ServiceView[];
}) {
  const router = useRouter();
  const [weekly, setWeekly] = useState<Weekly>(
    Array.from(
      { length: 7 },
      (_, i) =>
        staff?.weekly.find((p) => p.weekday === i + 1) ?? {
          weekday: i + 1,
          periods: !staff && i < 5 ? [{ start: "09:00", end: "17:00" }] : [],
          breaks: [],
        },
    ),
  );
  const [exceptions, setExceptions] = useState<Exceptions>(
      staff?.exceptions ?? [],
    ),
    [newDate, setNewDate] = useState("");
  const { write, pending, message, status } = useWrite();
  const [name, setName] = useState(staff?.name ?? "");
  const [active, setActive] = useState(staff?.active ?? true);
  const [serviceIds, setServiceIds] = useState(staff?.serviceIds ?? []);
  const snapshot = JSON.stringify({
    name,
    active,
    serviceIds: [...serviceIds].sort(),
    weekly,
    exceptions: [...exceptions].sort((a, b) => a.date.localeCompare(b.date)),
  });
  const [original] = useState(snapshot);
  const { markDirty, markClean } = useUnsavedChanges(snapshot !== original);
  function changeDay(index: number, patch: Partial<Weekly[number]>) {
    setWeekly((rows) =>
      rows.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
    markDirty();
  }
  function changeException(index: number, patch: Partial<Exceptions[number]>) {
    setExceptions((rows) =>
      rows.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
    markDirty();
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await write<{ id: string }>("/api/admin/staff", {
      ...(staff && { id: staff.id, expectedVersion: staff.version }),
      name: form.get("name"),
      active: form.get("active") === "on",
      serviceIds: form.getAll("serviceIds"),
      weekly: weekly.filter((day) => day.periods.length || day.breaks.length),
      exceptions,
    });
    if (result) {
      markClean();
      router.push(`/admin/staff?id=${encodeURIComponent(result.id)}&saved=1`);
      router.refresh();
    }
  }
  return (
    <form onSubmit={save} onChange={markDirty}>
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="staff-name">Namn (syntetiskt)</label>
          <input
            id="staff-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        <label className="check-label field">
          <input
            type="checkbox"
            name="active"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Aktiv för nya bokningar
        </label>
        <fieldset className="field">
          <legend>Behandlingar</legend>
          <div className="check-grid">
            {services.map((s) => (
              <label key={s.id} className="check-label">
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={s.id}
                  checked={serviceIds.includes(s.id)}
                  onChange={(event) =>
                    setServiceIds((ids) =>
                      event.target.checked
                        ? [...ids, s.id]
                        : ids.filter((id) => id !== s.id),
                    )
                  }
                />
                {s.name}
                {!s.active ? " (inaktiv)" : ""}
              </label>
            ))}
          </div>
        </fieldset>
        <h3>Veckoschema</h3>
        <p className="muted field">
          Tider i svensk tid, HH:MM. Inga arbetspass betyder ledigt. Pauser ska
          rymmas inom arbetspassen.
        </p>
        {weekly.map((day, index) => (
          <details className="schedule-day" key={day.weekday}>
            <summary>
              {weekdays[index]}{" "}
              <span>
                {day.periods.length
                  ? day.periods.map((p) => `${p.start}–${p.end}`).join(", ")
                  : "Ledig"}
              </span>
            </summary>
            <Periods
              label="Arbetspass"
              prefix={`weekday-${day.weekday}-work`}
              rows={day.periods}
              onChange={(periods) => changeDay(index, { periods })}
            />
            <Periods
              label="Pauser"
              prefix={`weekday-${day.weekday}-break`}
              rows={day.breaks}
              onChange={(breaks) => changeDay(index, { breaks })}
            />
          </details>
        ))}
        <h3 className="section-space">Ledighet och avvikande tider</h3>
        <p className="muted field">
          Välj dag och Lägg till datum. Dagen blir ledig om du inte lägger till
          arbetspass. Spara medarbetaren när du är klar. Detta ersätter
          veckoschemat bara den valda dagen.
        </p>
        {exceptions.map((day, index) => (
          <details className="schedule-day" key={index} open>
            <summary>
              {readableDay(day.date)} ·{" "}
              {day.periods.length ? "Avvikande tider" : "Ledig"}
            </summary>
            <div className="field">
              <details>
                <summary>Ändra dag · {readableDay(day.date)}</summary>
                <DatePicker
                  id={`exception-${index}-date`}
                  value={day.date}
                  onChange={(value) => changeException(index, { date: value })}
                />
              </details>
            </div>
            <Periods
              label="Arbetspass"
              prefix={`exception-${index}-work`}
              rows={day.periods}
              onChange={(periods) => changeException(index, { periods })}
            />
            <Periods
              label="Pauser"
              prefix={`exception-${index}-break`}
              rows={day.breaks}
              onChange={(breaks) => changeException(index, { breaks })}
            />
            <button
              type="button"
              className="danger-secondary"
              onClick={() => {
                setExceptions((rows) => rows.filter((_, i) => i !== index));
                markDirty();
              }}
            >
              Ta bort datumundantag
            </button>
          </details>
        ))}
        <div className="exception-add field">
          <div>
            <DatePicker
              id="new-exception-date"
              value={newDate}
              label="Välj dag för ledighet eller andra tider"
              onChange={setNewDate}
            />
          </div>
          <button
            type="button"
            className="secondary"
            disabled={
              !newDate ||
              exceptions.length >= 60 ||
              exceptions.some((e) => e.date === newDate)
            }
            onClick={() => {
              setExceptions((rows) => [
                ...rows,
                { date: newDate, periods: [], breaks: [] },
              ]);
              setNewDate("");
              markDirty();
            }}
          >
            Lägg till datum
          </button>
        </div>
        <p className="muted field">
          Ändringar som krockar med bokade tider nekas. Flytta eller avboka
          berörda bokningar först.
        </p>
        <div className="editor-actions">
          <p className="muted">
            Ändringarna sparas först när du väljer Spara medarbetare.
          </p>
          <button>{pending ? "Sparar…" : "Spara medarbetare"}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              markClean();
              router.replace("/admin/staff");
            }}
          >
            Avbryt
          </button>
        </div>
        <datalist id="schedule-times">
          {Array.from({ length: 49 }, (_, i) => {
            const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
            return <option key={value} value={value} />;
          })}
        </datalist>
      </fieldset>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {status === 409 && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            markClean();
            window.location.reload();
          }}
        >
          Läs in uppgifterna på nytt
        </button>
      )}
    </form>
  );
}
