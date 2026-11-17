"use client";

import { useState } from "react";
import { WEEK_ORDER } from "../../data/dates";
import type { Staff } from "../../data/types";
import { t, words } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { DayRow, TimeRange } from "./day-row";


/** The weekly template: hours per weekday, or a day off. Starts from the salon's opening hours. */
export function WeekSheet({ person, onClose }: { person: Staff; onClose: () => void }) {
  const { state } = useStudio();
  const [week, setWeek] = useState(person.week);
  const valid = Object.values(week).every((d) => !d || d.start < d.end);
  const save = () => {
    if (dispatch({ type: "staff/week", staffId: person.id, week })) showToast(t("schedule.weekSaved", { name: person.firstName }), { label: t("common.undo"), run: undo });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("schedule.weekTitle", { name: person.firstName })}
      description={t("schedule.weekText")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {WEEK_ORDER.map((d) => {
          const shift = week[d];
          const opening = state.salon.hours[d];
          const name = words.weekdays[d];
          return (
            <DayRow
              key={d}
              label={name}
              on={!!shift}
              switchLabel={t("schedule.works", { day: name })}
              off={opening ? t("calendar.off") : t("calendar.closed")}
              onToggle={() => opening && setWeek({ ...week, [d]: shift ? null : { start: opening.open, end: opening.close } })}
            >
              {shift && <TimeRange label={name} from={shift.start} to={shift.end} onChange={(start, end) => setWeek({ ...week, [d]: { start, end } })} />}
            </DayRow>
          );
        })}
        {!valid && <p className="text-sm text-danger">{t("hours.invalid")}</p>}
      </div>
    </Sheet>
  );
}
