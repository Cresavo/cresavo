"use client";

import { ListRow } from "../../ui/list-row";
import { addDays } from "../../data/dates";
import { openingFor } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayLong, formatTime } from "../../i18n/format";
import { dayBookings, findCustomer, findService, fullName, utilisation } from "../../selectors";
import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Meter } from "../../ui/charts";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

/** The week as a list per day (phones). */
export function WeekAgenda({ monday, staff, resourceId, onOpen }: { monday: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today } = useStudio();
  const staffId = staff.length === 1 ? staff[0].id : undefined;
  return (
    <div className="space-y-4">
      {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
        const list = dayBookings(state, d, staffId, resourceId);
        const closed = !openingFor(state.salon, d);
        return (
          <Card key={d} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={d === today ? "font-semibold text-action" : "font-semibold"}>{formatDayLong(d)}</p>
                {closed ? <Badge>{t("calendar.closed")}</Badge>
                  : <p className="text-meta text-text-secondary">{tc("calendar.bookingCount", list.length)}</p>}
              </div>
              {!closed && <Meter value={utilisation(state, d, 1, staffId)} className="w-20" />}
            </div>
            {list.length > 0 && (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {list.map((b) => {
                  const customer = findCustomer(state, b.customerId);
                  return (
                    <li key={b.id}>
                      <ListRow onClick={() => onOpen({ kind: "booking", id: b.id })}
                        leading={<><span className="w-12 shrink-0 font-medium tabular-nums">{formatTime(b.start)}</span><StaffDot staffId={b.staffId} /></>}
                        title={customer ? fullName(customer) : ""}
                        meta={staff.length > 1 ? staff.find((person) => person.id === b.staffId)?.firstName : undefined}
                        trailing={<span className="max-w-24 break-words text-meta text-text-secondary">{findService(state, b.serviceId)?.name}</span>} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
