"use client";

import { Check, Plus } from "lucide-react";
import { formatTime } from "../../data/dates";
import { freeGaps } from "../../data/slots";
import type { Booking, DateKey, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { Avatar } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";

type Row =
  | { kind: "booking"; start: number; booking: Booking }
  | { kind: "gap"; start: number; end: number; staffId: StaffId };

/** Today's bookings for everyone, with free gaps in between. */
export function Timeline({ date, onOpen }: { date: DateKey; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const now = date === today ? minutes : 0;
  const rows: Row[] = [
    ...state.bookings.filter((b) => b.date === date).map((b) => ({ kind: "booking" as const, start: b.start, booking: b })),
    ...state.staff.flatMap((s) =>
      freeGaps(state, s.id, date, { after: now, min: 30 }).map((g) => ({ kind: "gap" as const, ...g, staffId: s.id })),
    ),
  ].sort((a, b) => a.start - b.start);

  return (
    <ol className="relative space-y-2">
      {rows.map((row) => {
        if (row.kind === "gap") {
          const staff = state.staff.find((s) => s.id === row.staffId)!;
          return (
            <li key={`gap-${row.staffId}-${row.start}`} className="flex gap-3">
              <span className="w-12 shrink-0 pt-3 text-right text-sm tabular-nums text-eko-muted">{formatTime(row.start)}</span>
              <button
                onClick={() => onOpen({ kind: "new", preset: { staffId: row.staffId, date, start: row.start } })}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-dashed border-eko-line px-4 text-left text-sm text-eko-muted hover:border-eko-accent hover:bg-eko-accent-soft/40 hover:text-eko-ink"
              >
                <StaffDot staffId={row.staffId} />
                <span className="flex-1">
                  {t("today.free", { name: staff.firstName, from: formatTime(row.start), to: formatTime(row.end) })}
                  <span className="text-eko-muted"> · {formatDuration(row.end - row.start)}</span>
                </span>
                <Plus size={18} />
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
        return (
          <li key={b.id} className="flex gap-3">
            <span className={cx("w-12 shrink-0 pt-3.5 text-right text-sm font-medium tabular-nums", done || cancelled ? "text-eko-muted" : "text-eko-ink")}>
              {formatTime(b.start)}
            </span>
            <button
              onClick={() => onOpen({ kind: "booking", id: b.id })}
              className={cx(
                "flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-eko-surface px-3 py-2.5 text-left shadow-card ring-1 transition-colors hover:bg-eko-sunken",
                current ? "ring-2 ring-eko-accent" : "ring-eko-line/70",
                (done || cancelled) && "opacity-60",
              )}
            >
              {customer && <Avatar name={fullName(customer)} size="sm" />}
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate font-medium", cancelled && "line-through")}>{customer ? fullName(customer) : ""}</span>
                <span className="flex items-center gap-1.5 truncate text-sm text-eko-muted">
                  <StaffDot staffId={b.staffId} />
                  {service?.name} · {formatDuration(b.duration)}
                </span>
              </span>
              {current && <Badge tone="accent">{t("today.inProgress")}</Badge>}
              {cancelled && <Badge tone="danger">{t("status.cancelled")}</Badge>}
              {done && !cancelled && <Check size={18} className="text-eko-accent" aria-label={t("status.completed")} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
