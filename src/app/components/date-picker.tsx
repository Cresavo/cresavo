"use client";
import { useRef, useState } from "react";
import { DateTime } from "luxon";
import { readableDay } from "@/lib/format";

const zone = "Europe/Stockholm";
export default function DatePicker({
  id,
  value,
  onChange,
  name,
  min,
  max,
  label = "Välj dag",
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  min?: string;
  max?: string;
  label?: string;
  disabled?: boolean;
}) {
  const today = DateTime.now().setZone(zone).toISODate()!;
  const anchor = value || today;
  const [page, setPage] = useState({ anchor, month: anchor.slice(0, 7) });
  const [focus, setFocus] = useState(anchor);
  const moveFocus = useRef(false);
  const month = DateTime.fromISO(
    (page.anchor === anchor ? page.month : anchor.slice(0, 7)) + "-01",
    { zone },
  );
  const first = month.startOf("week");
  const days = Array.from(
    { length: Math.ceil((month.weekday - 1 + month.daysInMonth!) / 7) * 7 },
    (_, i) => first.plus({ days: i }),
  );
  const allowed = (v: string) =>
    !disabled && (!min || v >= min) && (!max || v <= max);
  const currentFocus = days.some(
    (d) => d.toISODate() === focus && d.month === month.month && allowed(focus),
  )
    ? focus
    : days
        .find((d) => d.month === month.month && allowed(d.toISODate()!))
        ?.toISODate();
  const turn = (by: number) =>
    setPage({ anchor, month: month.plus({ months: by }).toFormat("yyyy-MM") });
  return (
    <fieldset
      className="date-picker"
      data-month={month.toFormat("yyyy-MM")}
      disabled={disabled}
      aria-label={label}
    >
      <legend>{label}</legend>
      <input type="hidden" id={id} name={name} value={value} />
      <div className="month-heading">
        <button
          type="button"
          className="quiet-button"
          aria-label="Föregående månad"
          disabled={
            disabled ||
            (!!min &&
              month.startOf("month").toISODate()! <= min.slice(0, 7) + "-01")
          }
          onClick={() => turn(-1)}
        >
          ←
        </button>
        <strong aria-live="polite">
          {month.setLocale("sv").toFormat("MMMM yyyy")}
        </strong>
        <button
          type="button"
          className="quiet-button"
          aria-label="Nästa månad"
          disabled={
            disabled || (!!max && month.toFormat("yyyy-MM") >= max.slice(0, 7))
          }
          onClick={() => turn(1)}
        >
          →
        </button>
      </div>
      <div
        role="grid"
        aria-label={month.setLocale("sv").toFormat("MMMM yyyy")}
        className="month-grid"
      >
        <div role="row" className="month-row">
          {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
            <span role="columnheader" key={d}>
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, row) => (
          <div role="row" className="month-row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((d) => {
              const key = d.toISODate()!,
                outside = d.month !== month.month;
              return (
                <span role="gridcell" key={key} aria-selected={value === key}>
                  {outside ? (
                    <span className="outside-day" aria-hidden="true">
                      {d.day}
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-date={key}
                      ref={(node) => {
                        if (node && key === currentFocus && moveFocus.current) {
                          node.focus();
                          moveFocus.current = false;
                        }
                      }}
                      className={
                        value === key
                          ? "selected-day"
                          : key === today
                            ? "today-day"
                            : ""
                      }
                      aria-label={readableDay(key)}
                      aria-pressed={value === key}
                      aria-current={key === today ? "date" : undefined}
                      disabled={!allowed(key)}
                      tabIndex={key === currentFocus ? 0 : -1}
                      onFocus={() => setFocus(key)}
                      onClick={() => onChange(key)}
                      onKeyDown={(event) => {
                        const delta: Record<string, number> = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -7,
                          ArrowDown: 7,
                        };
                        let next =
                          event.key in delta
                            ? d.plus({ days: delta[event.key] })
                            : event.key === "Home"
                              ? d.startOf("week")
                              : event.key === "End"
                                ? d.endOf("week")
                                : event.key === "PageUp"
                                  ? d.minus({ months: 1 })
                                  : event.key === "PageDown"
                                    ? d.plus({ months: 1 })
                                    : null;
                        if (!next) return;
                        event.preventDefault();
                        if (min && next.toISODate()! < min)
                          next = DateTime.fromISO(min, { zone });
                        if (max && next.toISODate()! > max)
                          next = DateTime.fromISO(max, { zone });
                        const target = next.toISODate()!;
                        moveFocus.current = true;
                        setFocus(target);
                        setPage({ anchor, month: next.toFormat("yyyy-MM") });
                      }}
                    >
                      {d.day}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="chosen-day">
        {value ? readableDay(value) : "Tryck på en dag i kalendern."}
      </p>
      <details className="date-manual">
        <summary>Skriv datum med tangentbord</summary>
        <label htmlFor={`${id}-manual`}>Datum (ÅÅÅÅ-MM-DD)</label>
        <input
          id={`${id}-manual`}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            if (
              e.target.value &&
              DateTime.fromISO(e.target.value, { zone }).isValid &&
              allowed(e.target.value)
            )
              onChange(e.target.value);
          }}
        />
      </details>
    </fieldset>
  );
}
