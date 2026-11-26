"use client";

import { ListRow } from "../../ui/list-row";
import { addDays } from "../../data/dates";
import { openingFor } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayLong, formatTime } from "../../i18n/format";
import { dayBookings, findCustomer, findService, fullName, visitorName } from "../../selectors";
import { Badge } from "../../ui/badge";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";

/** The week as a list per day (phones). */
export function WeekAgenda({ monday, staff, resourceId, onOpen }: { monday: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today } = useStudio();
  const staffId = staff.length === 1 ? staff[0].id : undefined;
  return (
    <div className="space-y-6">
      {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
        const list = dayBookings(state, d, staffId, resourceId);
        const closed = !openingFor(state.salon, d);
        return (
          <section key={d}>
            <div className="flex items-center gap-3 px-1 pb-2" aria-current={d === today ? "date" : undefined}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {formatDayLong(d)}
                  {d === today && <span className="studio-today-mark rounded-full px-2 text-minimum">{t("date.today")}</span>}
                </p>
                {closed ? <Badge>{t("calendar.closed")}</Badge>
                  : <p className="text-meta text-text-secondary">{tc("calendar.bookingCount", list.length)}</p>}
              </div>
            </div>
            {list.length > 0 && (
              <ul className="divide-y divide-hairline border-y border-hairline">
                {list.map((b) => {
                  const customer = findCustomer(state, b.customerId);
                  return (
                    <li key={b.id}>
                      <ListRow className="!px-1" onClick={() => onOpen({ kind: "booking", id: b.id })}
                        leading={<><span className="w-12 shrink-0 font-medium tabular-nums">{formatTime(b.start)}</span><StaffDot staffId={b.staffId} /></>}
                        title={visitorName(b, customer)}
                        meta={[b.visitFor && customer && t("booking.bookedByName", { name: fullName(customer) }), staff.length > 1 && staff.find((person) => person.id === b.staffId)?.firstName].filter(Boolean).join(" · ") || undefined}
                        trailing={<span className="max-w-24 break-words text-meta text-text-secondary">{findService(state, b.serviceId)?.name}</span>} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
