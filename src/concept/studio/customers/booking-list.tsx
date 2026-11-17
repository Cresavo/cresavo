"use client";

import { ChevronRight } from "lucide-react";
import { formatTime } from "../../data/dates";
import type { Booking } from "../../data/types";
import { t } from "../../i18n";
import { formatDate, formatMoney } from "../../i18n/format";
import { findService } from "../../selectors";
import { Badge } from "../../ui/badge";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

/** Bookings for one customer, newest or soonest first. */
export function BookingList({ bookings, onOpen }: { bookings: Booking[]; onOpen: (sheet: OpenSheet) => void }) {
  const { state } = useStudio();
  return (
    <ul className="divide-y divide-border">
      {bookings.map((b) => (
        <li key={b.id}>
          <button onClick={() => onOpen({ kind: "booking", id: b.id })} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2">
            <span className="w-24 shrink-0">
              <span className="block font-medium">{formatDate(b.date)}</span>
              <span className="block tabular-nums text-text-secondary">{formatTime(b.start)}</span>
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <StaffDot staffId={b.staffId} />
              <span className="truncate">{findService(state, b.serviceId)?.name}</span>
            </span>
            {b.status === "cancelled" || b.status === "noshow" ? (
              <Badge tone="danger">{t(`status.${b.status}`)}</Badge>
            ) : (
              <span className="shrink-0 tabular-nums text-text-secondary">{formatMoney(b.price)}</span>
            )}
            <ChevronRight size={16} className="shrink-0 text-text-secondary" />
          </button>
        </li>
      ))}
    </ul>
  );
}
