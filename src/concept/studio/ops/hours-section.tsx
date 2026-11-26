"use client";

import { useState } from "react";
import { WEEK_ORDER } from "../../data/dates";
import type { Salon } from "../../data/types";
import { t, words } from "../../i18n";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { useStudio } from "../use-studio";
import { DayRow, TimeRange } from "./day-row";
import { dispatchWithUndoToast } from "../log/undo-toast";

const DEFAULT_OPEN = { open: 9 * 60, close: 17 * 60 };
const DEFAULT_LUNCH = { start: 12 * 60, end: 13 * 60 };

type Draft = Pick<Salon, "hours" | "lunch">;

const same = (draft: Draft, salon: Salon) =>
  JSON.stringify(draft.hours) === JSON.stringify(salon.hours) && JSON.stringify(draft.lunch) === JSON.stringify(salon.lunch);

/**
 * Opening hours per weekday and the lunch break, edited where they are listed. Turning a day on opens its times in
 * the row; Save and Cancel appear once something differs from the saved hours and rest above the phone tab bar.
 * Until then the list follows the saved hours, also when another tab changes them.
 */
export function HoursSection() {
  const { state } = useStudio();
  const { salon } = state;
  const [draft, setDraft] = useState<Draft | null>(null);
  const { hours, lunch } = draft ?? salon;
  const edit = (next: Partial<Draft>) => {
    const value = { hours, lunch, ...next };
    setDraft(same(value, salon) ? null : value);
  };
  const dirty = !!draft && !same(draft, salon);
  const valid = Object.values(hours).every((h) => !h || h.open < h.close) && (!lunch || lunch.start < lunch.end);
  const save = () => {
    dispatchWithUndoToast({ type: "salon/hours", hours, lunch }, t("hours.saved"));
    setDraft(null);
  };
  return (
    <Section title={t("settings.hours")}>
      <Card className="px-4">
        <div className="divide-y divide-hairline">
          {WEEK_ORDER.map((d) => {
            const day = hours[d];
            const name = words.weekdays[d];
            const shown = day ?? DEFAULT_OPEN;
            return (
              <div key={d} className="py-3">
                <DayRow label={name} on={!!day} switchLabel={t("hours.open", { day: name })} off={t("calendar.closed")}
                  onToggle={() => edit({ hours: { ...hours, [d]: day ? null : DEFAULT_OPEN } })}>
                  <TimeRange label={name} from={shown.open} to={shown.close} onChange={(open, close) => edit({ hours: { ...hours, [d]: { open, close } } })} />
                </DayRow>
              </div>
            );
          })}
          <div className="space-y-2 py-3">
            <DayRow label={t("hours.lunch")} on={!!lunch} switchLabel={t("hours.lunchOn")} off={t("hours.noLunch")} onToggle={() => edit({ lunch: lunch ? null : DEFAULT_LUNCH })}>
              <TimeRange label={t("hours.lunch")} from={(lunch ?? DEFAULT_LUNCH).start} to={(lunch ?? DEFAULT_LUNCH).end} onChange={(start, end) => edit({ lunch: { start, end } })} />
            </DayRow>
            <p className="text-xs text-text-secondary">{t("hours.lunchNote")}</p>
          </div>
        </div>
        {dirty && (
          <div className="studio-sticky-save ui-arrive flex flex-wrap items-center justify-end gap-2 border-t border-hairline">
            <p className={valid ? "mr-auto min-w-0 flex-1 basis-56 text-xs text-text-secondary" : "mr-auto min-w-0 flex-1 basis-56 text-sm text-danger"}>
              {t(valid ? "hours.editText" : "hours.invalid")}
            </p>
            <Button variant="ghost" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button width="responsive" disabled={!valid} onClick={save}>{t("common.save")}</Button>
          </div>
        )}
      </Card>
    </Section>
  );
}
