"use client";

import { formatTime } from "../../i18n/format";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { WEEK_ORDER } from "../../data/dates";
import type { Salon } from "../../data/types";
import { t, words } from "../../i18n";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { DayRow, TimeRange } from "./day-row";
import { dispatchWithUndoToast } from "../log/undo-toast";

const DEFAULT_OPEN = { open: 9 * 60, close: 17 * 60 };
const DEFAULT_LUNCH = { start: 12 * 60, end: 13 * 60 };

/** Opening hours per weekday and the lunch break, with an editor. */
export function HoursSection() {
  const { state } = useStudio();
  const [editing, setEditing] = useState(false);
  const { salon } = state;
  return (
    <Section
      title={t("settings.hours")}
      action={<Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>{t("common.edit")}</Button>}
    >
      <Card className="divide-y divide-hairline">
        {WEEK_ORDER.map((d) => {
          const hours = salon.hours[d];
          return (
            <div key={d} className="flex justify-between px-4 py-3 text-sm">
              <span>{words.weekdays[d]}</span>
              <span className={hours ? "font-medium tabular-nums" : "text-text-secondary"}>
                {hours ? `${formatTime(hours.open)}–${formatTime(hours.close)}` : t("calendar.closed")}
              </span>
            </div>
          );
        })}
        <div className="flex justify-between px-4 py-3 text-sm">
          <span>{t("hours.lunch")}</span>
          <span className={salon.lunch ? "font-medium tabular-nums" : "text-text-secondary"}>
            {salon.lunch ? `${formatTime(salon.lunch.start)}–${formatTime(salon.lunch.end)}` : t("hours.noLunch")}
          </span>
        </div>
      </Card>
      {editing && <HoursSheet salon={salon} onClose={() => setEditing(false)} />}
    </Section>
  );
}

function HoursSheet({ salon, onClose }: { salon: Salon; onClose: () => void }) {
  const [hours, setHours] = useState(salon.hours);
  const [lunch, setLunch] = useState(salon.lunch);
  const valid = Object.values(hours).every((h) => !h || h.open < h.close) && (!lunch || lunch.start < lunch.end);
  const save = () => {
    dispatchWithUndoToast({ type: "salon/hours", hours, lunch }, t("hours.saved"));
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("hours.editTitle")}
      description={t("hours.editText")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {WEEK_ORDER.map((d) => {
          const day = hours[d];
          const name = words.weekdays[d];
          return (
            <DayRow key={d} label={name} on={!!day} switchLabel={t("hours.open", { day: name })} off={t("calendar.closed")} onToggle={() => setHours({ ...hours, [d]: day ? null : DEFAULT_OPEN })}>
              {day && <TimeRange label={name} from={day.open} to={day.close} onChange={(open, close) => setHours({ ...hours, [d]: { open, close } })} />}
            </DayRow>
          );
        })}
        <div className="border-t border-hairline pt-4">
          <DayRow label={t("hours.lunch")} on={!!lunch} switchLabel={t("hours.lunchOn")} off={t("hours.noLunch")} onToggle={() => setLunch(lunch ? null : DEFAULT_LUNCH)}>
            {lunch && <TimeRange label={t("hours.lunch")} from={lunch.start} to={lunch.end} onChange={(start, end) => setLunch({ start, end })} />}
          </DayRow>
        </div>
        <p className="text-xs text-text-secondary">{t("hours.lunchNote")}</p>
        {!valid && <p className="text-sm text-danger">{t("hours.invalid")}</p>}
      </div>
    </Sheet>
  );
}
