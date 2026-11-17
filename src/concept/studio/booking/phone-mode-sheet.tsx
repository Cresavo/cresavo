"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus } from "lucide-react";
import { addDays, formatTime } from "../../data/dates";
import { freeGaps, openingFor } from "../../data/slots";
import type { DateKey } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration, relativeDay } from "../../i18n/format";
import { buildCustomerStats, fullName } from "../../selectors";
import { Avatar } from "../../ui/avatar";
import { Button } from "../../ui/button";
import { SearchInput } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import type { NewBookingPreset } from "./new-booking-sheet";

interface PhoneModeProps {
  onClose: () => void;
  onBook: (preset: NewBookingPreset) => void;
  onMove: (bookingId: string) => void;
}

/** "Someone is calling": find the caller fast and see the free times at a glance. */
export function PhoneModeSheet({ onClose, onBook, onMove }: PhoneModeProps) {
  const { state, today, minutes } = useStudio();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const stats = q ? buildCustomerStats(state, today) : null;
  const matches = q ? state.customers.filter((c) => fullName(c).toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))).slice(0, 4) : [];

  const days: DateKey[] = [];
  for (let i = 0; days.length < 5 && i < 14; i++) {
    const d = addDays(today, i);
    if (openingFor(state.salon, d)) days.push(d);
  }

  return (
    <Sheet open onClose={onClose} title={t("phone.title")} description={t("phone.subtitle")}>
      <div className="space-y-6">
        <div className="space-y-2">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("phone.search")} autoFocus />
          {matches.map((c) => {
            const next = stats?.get(c.id)?.nextBooking;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 p-3">
                <Avatar name={fullName(c)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{fullName(c)}</p>
                  <p className="text-sm text-text-secondary">
                    {next ? t("phone.nextBooking", { when: `${relativeDay(next.date, today)} ${formatTime(next.start)}` }) : t("phone.noBooking")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {next && (
                    <Button size="sm" variant="secondary" icon={<CalendarClock size={16} />} onClick={() => onMove(next.id)}>
                      {t("booking.move")}
                    </Button>
                  )}
                  <Button size="sm" icon={<CalendarPlus size={16} />} onClick={() => onBook({ customerId: c.id })}>
                    {t("phone.book")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">{t("phone.freeTimes")}</h3>
          {days.map((d) => {
            const gaps = state.staff.flatMap((s) =>
              freeGaps(state, s.id, d, { after: d === today ? minutes : 0, min: 30 }).map((g) => ({ ...g, staff: s })),
            ).sort((a, b) => a.start - b.start);
            return (
              <div key={d} className="space-y-2">
                <p className="font-medium">{relativeDay(d, today)}</p>
                {gaps.length ? (
                  <div className="flex flex-wrap gap-2">
                    {gaps.map((g) => (
                      <button
                        key={`${g.staff.id}-${g.start}`}
                        onClick={() => onBook({ staffId: g.staff.id, date: d, start: g.start })}
                        className={cx(
                          "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm ring-1 ring-inset hover:brightness-95",
                          g.staff.id === "anna" ? "bg-staff-1-bg ring-staff-1/20" : "bg-staff-2-bg ring-staff-2/20",
                        )}
                      >
                        <span className="font-semibold tabular-nums">{formatTime(g.start)}</span>
                        <span className="text-text-secondary">{g.staff.firstName} · {formatDuration(g.end - g.start)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">{t("phone.fullyBooked")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
