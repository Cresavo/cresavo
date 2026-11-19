import { WEEK_ORDER } from "../../data/dates";
import type { Salon } from "../../data/types";
import { t, words } from "../../i18n";
import { weeklyHours } from "../../onboarding/salon";
import { Button } from "../../ui/button";
import { DayRow, TimeRange } from "../ops/day-row";

export function SetupHours({ hours, change }: { hours: Salon["hours"]; change: (hours: Salon["hours"]) => void }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {[false, true].map(saturday => {
        const preset = weeklyHours(saturday);
        const selected = WEEK_ORDER.every(d => hours[d]?.open === preset[d]?.open && hours[d]?.close === preset[d]?.close);
        return <Button key={String(saturday)} variant="secondary" aria-pressed={selected} className="aria-pressed:bg-action-bg aria-pressed:ring-action"
          onClick={() => change(preset)}>{t(saturday ? "setup.saturday" : "setup.weekdays")}</Button>;
      })}
    </div>
    <details className="rounded-lg border border-hairline bg-surface px-4">
      <summary className="cursor-pointer py-3 font-medium">{t("setup.editDays")}</summary>
      <div className="divide-y divide-hairline pb-2">{WEEK_ORDER.map(d => {
        const day = hours[d], label = words.weekdays[d];
        return <div key={d} className="py-1"><DayRow label={label} switchLabel={t("hours.open", { day: label })} on={!!day}
          off={t("calendar.closed")} onToggle={() => change({ ...hours, [d]: day ? null : { open: 540, close: 1020 } })}>
          {day && <TimeRange label={label} from={day.open} to={day.close} onChange={(open, close) => change({ ...hours, [d]: { open, close } })} />}
        </DayRow></div>;
      })}</div>
    </details>
    {Object.values(hours).some(day => day && day.open >= day.close) && <p role="alert">{t("setup.hoursError")}</p>}
  </div>;
}
