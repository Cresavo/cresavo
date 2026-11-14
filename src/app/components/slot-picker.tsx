"use client";
import { useLocale } from "./locale-provider";
import { text } from "@/lib/locale";
export default function SlotPicker({
  id,
  slots,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  slots: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  return (
    <fieldset className="slot-picker" disabled={disabled}>
      <legend>
        {text(locale, "Choose an available time", "Välj ledig tid")}
      </legend>
      <input id={id} type="hidden" value={value} />
      <div className="slot-grid">
        {slots.map((slot) => (
          <button
            key={slot}
            data-slot={slot}
            type="button"
            aria-pressed={value === slot}
            className={value === slot ? "selected-slot" : "quiet-button"}
            onClick={() => onChange(slot)}
          >
            {new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Stockholm",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(slot))}
          </button>
        ))}
      </div>
      <p className="muted">
        {text(locale, "Stockholm time.", "Tiderna visas i svensk tid.")}{" "}
        {slots.length}{" "}
        {locale === "en"
          ? slots.length === 1
            ? "available time"
            : "available times"
          : slots.length === 1
            ? "ledig tid"
            : "lediga tider"}
        .
      </p>
    </fieldset>
  );
}
