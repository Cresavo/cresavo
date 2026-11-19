"use client";

import { Check, Plus } from "lucide-react";
import { freeGaps } from "../../data/slots";
import type { Booking, DateKey, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { Badge } from "../../ui/badge";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";

type Row =
  | { kind: "booking"; start: number; booking: Booking }
  | { kind: "gap"; start: number; end: number; staffId: StaffId };

// Time has its own column: a tabular time on one left edge, then who and what
// in a second column. A free slot gets the same row and type size as a visit.
const ROW = "flex min-h-[3.75rem] w-full items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 max-[299px]:gap-3 max-[299px]:px-3";
const TIME = "w-12 shrink-0 text-[15px] font-medium tabular-nums";

/** Today's bookings for everyone (or one person), with free gaps in between. */
export function Timeline({ date, staffId, onOpen }: { date: DateKey; staffId?: StaffId; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const now = date === today ? minutes : 0;
  const rows: Row[] = [
    ...state.bookings.filter((b) => b.date === date && (!staffId || b.staffId === staffId)).map((b) => ({ kind: "booking" as const, start: b.start, booking: b })),
    ...state.staff.filter((s) => !staffId || s.id === staffId).flatMap((s) =>
      freeGaps(state, s.id, date, { after: now, min: 30 }).map((g) => ({ kind: "gap" as const, ...g, staffId: s.id })),
    ),
  ].sort((a, b) => a.start - b.start);

  return (
    <ol className="divide-y divide-hairline overflow-hidden rounded-lg bg-surface ring-1 ring-hairline">
      {rows.map((row) => {
        if (row.kind === "gap") {
          const staff = state.staff.find((s) => s.id === row.staffId)!;
          return (
            <li key={`gap-${row.staffId}-${row.start}`} data-figure-row>
              <button onClick={() => onOpen({ kind: "new", preset: { staffId: row.staffId, date, start: row.start } })} className={ROW}>
                <span className={cx(TIME, "text-text-secondary")}>{formatTime(row.start)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-text-secondary">{t("today.free", { duration: formatDuration(row.end - row.start) })}</span>
                  <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <StaffDot staffId={row.staffId} />
                    <span className="truncate">{staff.firstName}</span>
                  </span>
                </span>
                <Plus size={18} className="shrink-0 text-text-secondary" aria-hidden />
              </button>
            </li>
          );
        }
        const b = row.booking;
        const customer = findCustomer(state, b.customerId);
        const service = findService(state, b.serviceId);
        const done = b.start + b.duration <= now;
        const current = !done && b.start <= now && b.status === "booked";
        const cancelled = b.status === "cancelled";
        const quiet = done || cancelled;
        // The staff colour is a quick cue only; the name says it in words (WCAG 1.4.1).
        const person = state.staff.length > 1 ? state.staff.find((s) => s.id === b.staffId)?.firstName : undefined;
        return (
          <li key={b.id} data-figure-row className="relative">
            {current && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-action" />}
            <button onClick={() => onOpen({ kind: "booking", id: b.id })} className={ROW}>
              <span className={cx(TIME, quiet && "text-text-secondary")}>{formatTime(b.start)}</span>
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate font-medium", cancelled && "line-through", quiet && "text-text-secondary")}>{customer ? fullName(customer) : ""}</span>
                <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <StaffDot staffId={b.staffId} />
                  <span className="truncate">
                    {/* The name first, so a narrow row truncates the treatment, not who it is with. */}
                    {person && `${person} · `}
                    {service && /\d+ min/.test(service.name) ? service.name : `${service?.name} · ${formatDuration(b.duration)}`}
                  </span>
                </span>
              </span>
              {current && <Badge tone="accent">{t("today.inProgress")}</Badge>}
              {cancelled && <Badge tone="danger">{t("status.cancelled")}</Badge>}
              {done && !cancelled && <Check size={18} className="shrink-0 text-text-secondary" aria-label={t("status.completed")} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
