"use client";

import { useId, useState } from "react";
import { WEEK_ORDER } from "../../data/dates";
import type { Salon } from "../../data/types";
import { t, words } from "../../i18n";
import { hoursValid, sameHours } from "../../onboarding/salon";
import { Button } from "../../ui/button";
import { Chip } from "../../ui/controls";
import { DayRow, TimeRange } from "../ops/day-row";

const DEFAULT_OPEN = { open: 9 * 60, close: 17 * 60 };

type Hours = Salon["hours"];

/** Why the hours cannot be used yet, or null. */
export function hoursIssue(hours: Hours): "setup.issue.days" | "hours.invalid" | null {
  if (!WEEK_ORDER.some(day => hours[day])) return "setup.issue.days";
  return hoursValid(hours) ? null : "hours.invalid";
}

/**
 * Opening hours in the lightest form that fits: the open days and one set of times. "Different hours on some days"
 * opens the same day-by-day rows as Settings.
 */
export function SetupHours({ hours, change }: { hours: Hours; change: (hours: Hours) => void }) {
  const open = WEEK_ORDER.filter(day => hours[day]);
  const spans = open.map(day => hours[day]!);
  const first = spans[0] ?? DEFAULT_OPEN;
  const [perDay, setPerDay] = useState(() => spans.some(span => span.open !== first.open || span.close !== first.close));
  const issue = hoursIssue(hours);
  const daysId = useId();
  const timesId = useId();
  return <div className="space-y-6">
    {perDay ? <div className="divide-y divide-hairline">
      {WEEK_ORDER.map(day => {
        const span = hours[day];
        const name = words.weekdays[day];
        const shown = span ?? first;
        return <div key={day} className="py-3">
          <DayRow label={name} on={!!span} switchLabel={t("hours.open", { day: name })} off={t("calendar.closed")}
            onToggle={() => change({ ...hours, [day]: span ? null : { ...first } })}>
            <TimeRange label={name} from={shown.open} to={shown.close} onChange={(from, to) => change({ ...hours, [day]: { open: from, close: to } })} />
          </DayRow>
        </div>;
      })}
    </div> : <>
      <div className="space-y-2">
        <p id={daysId} className="text-body font-medium">{t("setup.openDays")}</p>
        <div role="group" aria-labelledby={daysId} className="flex gap-1.5 md:max-w-field-short">
          {WEEK_ORDER.map(day => <Chip key={day} className="flex-1 justify-center px-0" active={!!hours[day]}
            onClick={() => change({ ...hours, [day]: hours[day] ? null : { ...first } })}>
            <span aria-hidden>{words.weekdaysShort[day]}</span><span className="sr-only">{words.weekdays[day]}</span>
          </Chip>)}
        </div>
      </div>
      <div className="space-y-2">
        <p id={timesId} className="text-body font-medium">{t("setup.openTimes")}</p>
        <div role="group" aria-labelledby={timesId} className="md:max-w-field-short">
          <TimeRange label={t("setup.open")} from={first.open} to={first.close} onChange={(from, to) => change(sameHours(open, from, to))} />
        </div>
      </div>
    </>}
    {issue && <p role="alert" className="text-meta text-danger">{t(issue)}</p>}
    <Button variant="link" className="-ml-1 px-1" onClick={() => {
      if (perDay) change(sameHours(open, first.open, first.close));
      setPerDay(!perDay);
    }}>{t(perDay ? "setup.sameDaily" : "setup.perDay")}</Button>
  </div>;
}
