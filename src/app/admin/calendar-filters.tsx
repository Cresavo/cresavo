"use client";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import DatePicker from "../components/date-picker";
import { readableDay } from "@/lib/format";
import { useLocale } from "../components/locale-provider";
import { text } from "@/lib/locale";
export default function CalendarFilters({
  date,
  href,
  staffId,
  staff,
  status,
}: {
  date: string;
  href: string;
  staffId: string;
  staff: { id: string; name: string; active: boolean }[];
  status: string;
}) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const details = useRef<HTMLDetailsElement>(null),
    summary = useRef<HTMLElement>(null);
  const change = (key: string, value: string) => {
    const url = new URL(href, window.location.origin);
    url.searchParams.set(key, value);
    url.searchParams.delete("cursor");
    if (key === "date") {
      if (details.current) details.current.open = false;
      summary.current?.focus();
    }
    startTransition(() => router.push(url.pathname + url.search));
  };
  return (
    <div className="calendar-filters" aria-busy={pending}>
      <details className="calendar-date-choice" ref={details}>
        <summary className="quiet-button" ref={summary}>
          {t("Choose day", "Välj dag")} · {readableDay(date, locale)}
        </summary>
        <DatePicker
          id="calendar-date"
          value={date}
          disabled={pending}
          onChange={(next) => change("date", next)}
        />
      </details>
      <div>
        <label htmlFor="calendar-staff">
          {t("Team member", "Medarbetare")}
        </label>
        <select
          id="calendar-staff"
          disabled={pending}
          value={staffId}
          onChange={(e) => change("staffId", e.target.value)}
        >
          <option value="">{t("All", "Alla")}</option>
          {staff.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
              {!p.active ? t(" (inactive)", " (inaktiv)") : ""}
            </option>
          ))}
        </select>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          disabled={pending}
          checked={status === "all"}
          onChange={(e) =>
            change("status", e.target.checked ? "all" : "confirmed")
          }
        />
        {t("Show cancelled", "Visa avbokade")}
      </label>
      {pending && (
        <p role="status" className="muted">
          {t("Updating calendar…", "Uppdaterar kalendern…")}
        </p>
      )}
    </div>
  );
}
