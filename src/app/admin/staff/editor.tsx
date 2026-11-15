"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffView, ServiceView } from "../types";
import type { Weekly, Exceptions } from "@/lib/schedule";
import { useWrite, useUnsavedChanges } from "../use-write";
import DatePicker from "../../components/date-picker";
import { readableDay } from "@/lib/format";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";

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
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const displayLabel =
    label === "Pauser"
      ? t("Breaks", "Pauser")
      : t("Working hours", "Arbetspass");
  const nextStart =
    rows.at(-1)?.end ?? (label === "Pauser" ? "12:00" : "09:00");
  const [hour, minute] = nextStart.split(":").map(Number);
  const nextEndMinutes = Math.min(1440, hour * 60 + minute + 60);
  const nextEnd = `${String(Math.floor(nextEndMinutes / 60)).padStart(2, "0")}:${String(nextEndMinutes % 60).padStart(2, "0")}`;
  return (
    <div className="periods">
      <h4>{displayLabel}</h4>
      {rows.map((row, index) => (
        <div className="period-row" key={index}>
          <div>
            <label htmlFor={`${prefix}-${index}-start`}>
              {t("From", "Från")}
            </label>
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
            <label htmlFor={`${prefix}-${index}-end`}>
              {t("Until", "Till")}
            </label>
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
            aria-label={`${t("Remove", "Ta bort")} ${displayLabel.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            {t("Remove", "Ta bort")}
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
        {label === "Pauser"
          ? t("Add break", "Lägg till paus")
          : t("Add working period", "Lägg till arbetspass")}
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
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const dayNames =
    locale === "en"
      ? [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]
      : weekdays;
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
          <label htmlFor="staff-name">
            {t("Name (fictional)", "Namn (syntetiskt)")}
          </label>
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
          {t("Available for new bookings", "Aktiv för nya bokningar")}
        </label>
        <fieldset className="field">
          <legend>{t("Treatments", "Behandlingar")}</legend>
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
                {!s.active ? t(" (inactive)", " (inaktiv)") : ""}
              </label>
            ))}
          </div>
        </fieldset>
        <h3>{t("Weekly schedule", "Veckoschema")}</h3>
        <p className="muted field">
          {t(
            "Stockholm time, HH:MM. No working periods means a day off. Breaks must fit within working hours.",
            "Tider i svensk tid, HH:MM. Inga arbetspass betyder ledigt. Pauser ska rymmas inom arbetspassen.",
          )}
        </p>
        {weekly.map((day, index) => (
          <details className="schedule-day" key={day.weekday}>
            <summary>
              {dayNames[index]}{" "}
              <span>
                {day.periods.length
                  ? day.periods.map((p) => `${p.start}–${p.end}`).join(", ")
                  : t("Day off", "Ledig")}
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
        <h3 className="section-space">
          {t(
            "Time off and schedule exceptions",
            "Ledighet och avvikande tider",
          )}
        </h3>
        <p className="muted field">
          {t(
            "Choose a day and add it. Leave working hours empty for a day off. Save the team member when done. This replaces the weekly schedule for that day only.",
            "Välj dag och Lägg till datum. Dagen blir ledig om du inte lägger till arbetspass. Spara medarbetaren när du är klar. Detta ersätter veckoschemat bara den valda dagen.",
          )}
        </p>
        {exceptions.map((day, index) => (
          <details className="schedule-day" key={index} open>
            <summary>
              {readableDay(day.date, locale)} ·{" "}
              {day.periods.length
                ? t("Custom hours", "Avvikande tider")
                : t("Day off", "Ledig")}
            </summary>
            <div className="field">
              <details>
                <summary>
                  {t("Change day", "Ändra dag")} ·{" "}
                  {readableDay(day.date, locale)}
                </summary>
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
              {t("Remove date exception", "Ta bort datumundantag")}
            </button>
          </details>
        ))}
        <div className="exception-add field">
          <div>
            <DatePicker
              id="new-exception-date"
              value={newDate}
              label={t(
                "Choose a day for time off or custom hours",
                "Välj dag för ledighet eller andra tider",
              )}
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
            {t("Add date", "Lägg till datum")}
          </button>
        </div>
        <p className="muted field">
          {t(
            "Changes that conflict with bookings are rejected. Move or cancel the affected bookings first.",
            "Ändringar som krockar med bokade tider nekas. Flytta eller avboka berörda bokningar först.",
          )}
        </p>
        <div className="editor-actions">
          <p className="muted">
            {t(
              "Changes are saved only when you choose Save team member.",
              "Ändringarna sparas först när du väljer Spara medarbetare.",
            )}
          </p>
          <button>
            {pending
              ? t("Saving…", "Sparar…")
              : t("Save team member", "Spara medarbetare")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              markClean();
              router.replace("/admin/staff");
            }}
          >
            {t("Cancel", "Avbryt")}
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
          {presentationError(message, locale)}
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
          {t("Reload latest details", "Läs in uppgifterna på nytt")}
        </button>
      )}
    </form>
  );
}
