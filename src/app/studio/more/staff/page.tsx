"use client";

import { addDays } from "@/concept/data/dates";
import { t, tc } from "@/concept/i18n";
import { formatMoney, formatNumber } from "@/concept/i18n/format";
import { dayBookings, revenueSplit, utilisation } from "@/concept/selectors";
import { CalendarFeed, useCalendarFeeds } from "@/concept/studio/more/calendar-feed";
import { StaffSchedule } from "@/concept/studio/ops/staff-schedule";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Card } from "@/concept/ui/card";
import { Meter } from "@/concept/ui/charts";
import { cx } from "@/concept/ui/cx";

export default function StaffPage() {
  const { state, today } = useStudio();
  const monthStart = `${today.slice(0, 7)}-01`;
  const revenue = revenueSplit(state, today, monthStart, "staffId");
  const feeds = useCalendarFeeds();

  return (
    <MorePage title={t("nav.staff")} subtitle={t("staff.subtitle")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {state.staff.map((person) => {
          const busy = utilisation(state, today, 7, person.id);
          let week = 0;
          for (let i = 0; i < 7; i++) week += dayBookings(state, addDays(today, i), person.id).length;
          const anna = person.id === "anna";
          return (
            <Card key={person.id} className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <span className={cx("flex size-14 items-center justify-center rounded-full text-lg font-semibold", anna ? "bg-staff-1-bg text-text" : "bg-staff-2-bg text-text")}>
                  {person.firstName[0]}
                  {person.lastName[0]}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{person.firstName} {person.lastName}</p>
                  <p className="text-sm text-text-secondary">{person.title} · {person.role}</p>
                </div>
              </div>
              <p className="text-sm">{person.bio}</p>
              <StaffSchedule person={person} />
              <div className="grid grid-cols-3 gap-3 border-t border-hairline pt-4 text-sm">
                <div>
                  <p className="text-text-secondary">{t("staff.next7")}</p>
                  <p className="font-semibold">{tc("calendar.bookingCount", week)}</p>
                </div>
                <div>
                  <p className="text-text-secondary">{t("staff.booked")}</p>
                  <p className="font-semibold">{t("format.percent", { value: formatNumber(busy * 100) })}</p>
                  <Meter value={busy} className="mt-1.5" />
                </div>
                <div>
                  <p className="text-text-secondary">{t("staff.thisMonth")}</p>
                  <p className="font-semibold">{formatMoney(revenue.find((r) => r.id === person.id)?.total ?? 0)}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-text-secondary">{t("staff.services")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.services.filter((s) => s.staffIds.includes(person.id)).map((s) => <Badge key={s.id}>{s.name}</Badge>)}
                </div>
              </div>
              {feeds && <CalendarFeed name={person.firstName} path={feeds[person.id]} />}
            </Card>
          );
        })}
      </div>
    </MorePage>
  );
}
