"use client";

import { ListRow } from "../../ui/list-row";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { freeGaps } from "../../data/slots";
import type { Booking, DateKey, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName, visitorName } from "../../selectors";
import { Badge, Tag } from "../../ui/badge";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { scheduleRows } from "./limits";

type Row =
  | { kind: "booking"; start: number; end: number; booking: Booking }
  | { kind: "gap"; start: number; end: number; staffId: StaffId };

// Time has its own column: a tabular time on one left edge, then who and what
// in a second column. A free slot gets the same row and type size as a visit.
const TIME = "w-12 shrink-0 text-body font-medium tabular-nums";

/** Today's bookings for everyone (or one person), with free gaps in between: the next few first, the whole day on request. */
export function Timeline({ date, staffId, onOpen }: { date: DateKey; staffId?: StaffId; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const [showAll, setShowAll] = useState(false);
  const now = date === today ? minutes : 0;
  const all: Row[] = [
    ...state.bookings.filter((b) => b.date === date && (!staffId || b.staffId === staffId)).map((b) => ({ kind: "booking" as const, start: b.start, end: b.start + b.duration, booking: b })),
    ...state.staff.filter((s) => !staffId || s.id === staffId).flatMap((s) =>
      freeGaps(state, s.id, date, { after: now, min: 30 }).map((g) => ({ kind: "gap" as const, ...g, staffId: s.id })),
    ),
  ].sort((a, b) => a.start - b.start);
  const rows = scheduleRows(all, now, showAll);

  return (
    <div className="space-y-2">
      <ol className="divide-y divide-hairline overflow-hidden rounded-lg bg-surface ring-1 ring-hairline">
        {rows.map((row) => {
          if (row.kind === "gap") {
            const staff = state.staff.find((s) => s.id === row.staffId)!;
            return (
              <li key={`gap-${row.staffId}-${row.start}`} data-figure-row>
                <ListRow onClick={() => onOpen({ kind: "new", preset: { staffId: row.staffId, date, start: row.start } })}
                  leading={<span className={cx(TIME, "text-text-secondary")}>{formatTime(row.start)}</span>}
                  title={<span className="text-text-secondary">{t("today.free", { duration: formatDuration(row.end - row.start) })}</span>}
                  meta={<span className="flex items-center gap-2"><StaffDot staffId={row.staffId} />{staff.firstName}</span>}
                  trailing={<Plus size={18} className="shrink-0 text-text-secondary" aria-hidden />} />
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
              {current && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-action" />}
              <ListRow onClick={() => onOpen({ kind: "booking", id: b.id })}
                leading={<span className={cx(TIME, quiet && "text-text-secondary")}>{formatTime(b.start)}</span>}
                title={<span className={cx(cancelled && "line-through", quiet && "text-text-secondary")}>{visitorName(b, customer)}</span>}
                meta={<span className="flex items-center gap-2">
                  <StaffDot staffId={b.staffId} />
                  <span>
                    {b.visitFor && customer && `${t("booking.bookedByName", { name: fullName(customer) })} · `}
                    {person && `${person} · `}
                    {service && /\d+ min/.test(service.name) ? service.name : `${service?.name} · ${formatDuration(b.duration)}`}
                  </span>
                </span>}
                trailing={<span className="flex flex-wrap justify-end gap-1">
                  {b.example && <Tag>{t("setup.example.tag")}</Tag>}
                  {current && <Badge tone="accent">{t("today.inProgress")}</Badge>}
                  {cancelled && <Badge tone="danger">{t("status.cancelled")}</Badge>}
                  {done && !cancelled && <Badge icon={Check}>{t("status.completed")}</Badge>}
                </span>} />
            </li>
          );
        })}
      </ol>
      {rows.length < all.length && (
        <Button variant="tertiary" width="responsive" onClick={() => setShowAll(true)}>{t("today.showAll", { count: all.length })}</Button>
      )}
    </div>
  );
}
