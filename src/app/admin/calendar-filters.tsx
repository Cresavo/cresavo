"use client";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import DatePicker from "../components/date-picker";
import { readableDay } from "@/lib/format";
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
          Välj dag · {readableDay(date)}
        </summary>
        <DatePicker
          id="calendar-date"
          value={date}
          disabled={pending}
          onChange={(next) => change("date", next)}
        />
      </details>
      <div>
        <label htmlFor="calendar-staff">Medarbetare</label>
        <select
          id="calendar-staff"
          disabled={pending}
          value={staffId}
          onChange={(e) => change("staffId", e.target.value)}
        >
          <option value="">Alla</option>
          {staff.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
              {!p.active ? " (inaktiv)" : ""}
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
        Visa avbokade
      </label>
      {pending && (
        <p role="status" className="muted">
          Uppdaterar kalendern…
        </p>
      )}
    </div>
  );
}
