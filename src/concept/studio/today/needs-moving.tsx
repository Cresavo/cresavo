"use client";

import { CalendarClock } from "lucide-react";
import type { StaffId } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { needsMoving } from "../../ops/needs-moving";
import { findCustomer, findService, fullName } from "../../selectors";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";

const SHOWN = 4;

/** Bookings that no longer fit the plan (someone is off, the salon is closed). The owner moves them one by one. */
export function NeedsMoving({ staffId, onOpen }: { staffId?: StaffId; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const list = needsMoving(state, today, minutes).filter(({ booking }) => !staffId || booking.staffId === staffId);
  if (!list.length) return null;
  const hidden = list.length - SHOWN;
  return (
    <Card className="overflow-hidden ring-warning/30">
      <div className="flex items-start gap-3 bg-warning-bg px-4 py-3">
        <CalendarClock size={20} className="mt-1 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-medium leading-snug">{tc("moving.title", list.length)}</p>
          <p className="text-sm text-text-secondary">{t("moving.text")}</p>
        </div>
      </div>
      <ul className="divide-y divide-hairline">
        {list.slice(0, SHOWN).map(({ booking, reason }) => {
          const customer = findCustomer(state, booking.customerId);
          const person = state.staff.find((s) => s.id === booking.staffId)?.firstName ?? "";
          return (
            <li key={booking.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{customer ? fullName(customer) : ""} · {findService(state, booking.serviceId)?.name}</p>
                <p className="truncate text-text-secondary">{formatDayShort(booking.date)} {formatTime(booking.start)} · {t(`moving.reason.${reason}`, { name: person })}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onOpen({ kind: "booking", id: booking.id, mode: "move" })}>{t("moving.move")}</Button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <p className="border-t border-hairline px-4 py-3 text-sm text-text-secondary">{tc("moving.more", hidden)}</p>}
    </Card>
  );
}
