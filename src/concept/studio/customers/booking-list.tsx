"use client";

import { ListRow } from "../../ui/list-row";
import { ChevronRight } from "lucide-react";
import type { Booking } from "../../data/types";
import { t } from "../../i18n";
import { formatDate, formatMoney, formatTime } from "../../i18n/format";
import { findService } from "../../selectors";
import { Badge } from "../../ui/badge";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

/** Bookings for one customer, newest or soonest first. */
export function BookingList({ bookings, onOpen }: { bookings: Booking[]; onOpen: (sheet: OpenSheet) => void }) {
  const { state } = useStudio();
  return (
    <ul className="divide-y divide-hairline">
      {bookings.map((b) => (
        <li key={b.id}>
          <ListRow onClick={() => onOpen({ kind: "booking", id: b.id })}
            leading={<span className="shrink-0 text-meta">
              <span className="block font-medium">{formatDate(b.date)}</span>
              <span className="block tabular-nums text-text-secondary">{formatTime(b.start)}</span>
            </span>}
            title={<span className="flex items-center gap-2">
              <StaffDot staffId={b.staffId} />
              <span className="min-w-0 break-words">
                {state.staff.length > 1 && `${state.staff.find((s) => s.id === b.staffId)?.firstName ?? ""} · `}
                {findService(state, b.serviceId)?.name}
              </span>
            </span>}
            trailing={<>
              {b.status === "cancelled" || b.status === "noshow"
                ? <Badge tone="danger">{t(`status.${b.status}`)}</Badge>
                : <span className="shrink-0 text-meta tabular-nums text-text-secondary">{formatMoney(b.price)}</span>}
              <ChevronRight size={16} aria-hidden className="shrink-0 text-text-secondary" />
            </>} />
        </li>
      ))}
    </ul>
  );
}
