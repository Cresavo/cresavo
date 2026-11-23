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
import { NextDetails, nextToday, whenText } from "./next-customer";

type Row =
  | { kind: "booking"; start: number; end: number; booking: Booking }
  | { kind: "gap"; start: number; end: number; staffId: StaffId };

// Time has its own quiet column: a tabular time on one left edge, then who and what in a second column. The rows
// have no frame; the next visit is the one row on a surface, with what you need to know right under it.
const TIME = "w-12 shrink-0 self-start pt-0.5 text-body tabular-nums";
const ROW = "!px-3";

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
  const next = date === today ? nextToday(state, today, minutes, staffId) : undefined;

  return (
    <div className="space-y-2">
      <ol className="-mx-3 space-y-1">
        {rows.map((row) => {
          if (row.kind === "gap") {
            const staff = state.staff.find((s) => s.id === row.staffId)!;
            return (
              // A soft gap: a dashed rail between the time and the text, the text in the quiet colour.
              <li key={`gap-${row.staffId}-${row.start}`} data-figure-row className="relative before:absolute before:inset-y-3 before:left-16 before:border-l before:border-dashed before:border-input-border">
                <ListRow onClick={() => onOpen({ kind: "new", preset: { staffId: row.staffId, date, start: row.start } })} className={cx(ROW, "min-h-16")}
                  leading={<span className={cx(TIME, "text-text-secondary")}>{formatTime(row.start)}</span>}
                  title={<span className="font-normal text-text-secondary">{t("today.free", { duration: formatDuration(row.end - row.start) })}</span>}
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
          const isNext = next?.id === b.id;
          // The staff colour is a quick cue only; the name says it in words (WCAG 1.4.1).
          const person = state.staff.length > 1 ? state.staff.find((s) => s.id === b.staffId)?.firstName : undefined;
          return (
            <li key={b.id} data-figure-row className={cx(isNext && "studio-raised my-3 rounded-lg bg-surface")}>
              <ListRow onClick={() => onOpen({ kind: "booking", id: b.id })} className={cx(ROW, isNext && "pt-3")}
                leading={<span className={cx(TIME, isNext ? "font-semibold" : "text-text-secondary")}>{formatTime(b.start)}</span>}
                title={<span className={cx(isNext && "text-lg font-semibold tracking-tight", cancelled && "line-through", quiet && "font-normal text-text-secondary")}>{visitorName(b, customer)}</span>}
                meta={<span className="flex items-center gap-2">
                  <StaffDot staffId={b.staffId} />
                  <span>
                    {b.visitFor && customer && `${t("booking.bookedByName", { name: fullName(customer) })} · `}
                    {person && `${person} · `}
                    {service?.name}
                    {!(service && /\d+ min/.test(service.name)) && <> · <span className="whitespace-nowrap">{formatDuration(b.duration)}</span></>}
                  </span>
                </span>}
                trailing={<span className="flex flex-wrap justify-end gap-1">
                  {b.example && <Tag>{t("setup.example.tag")}</Tag>}
                  {current && <span className="inline-flex items-center gap-2 text-meta font-medium text-text"><span aria-hidden className="size-2 rounded-full bg-action" />{t("today.inProgress")}</span>}
                  {isNext && !current && <span className="text-meta font-medium text-text">{whenText(b, today, minutes)}</span>}
                  {cancelled && <Badge tone="danger">{t("status.cancelled")}</Badge>}
                  {done && !cancelled && <Badge icon={Check}>{t("status.completed")}</Badge>}
                </span>} />
              {/* The details line up with the name: an empty time column, then the same gap. */}
              {isNext && <div className="flex gap-3 px-3 pb-3">
                <span aria-hidden className="w-12 shrink-0" />
                <div className="min-w-0 flex-1"><NextDetails booking={b} onOpen={onOpen} /></div>
              </div>}
            </li>
          );
        })}
      </ol>
      {rows.length < all.length && (
        <Button variant="link" onClick={() => setShowAll(true)}>{t("today.showAll", { count: all.filter((row) => row.kind === "booking" && row.booking.status !== "cancelled").length })}</Button>
      )}
    </div>
  );
}
