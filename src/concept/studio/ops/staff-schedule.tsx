"use client";

import { useState } from "react";
import { CalendarClock, CalendarMinus, Pencil, X } from "lucide-react";
import { WEEK_ORDER } from "../../data/dates";
import type { Staff } from "../../data/types";
import { t, words } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { Button, IconButton } from "../../ui/button";
import { useStudio } from "../use-studio";
import { OffSheet, ShiftSheet } from "./exception-sheets";
import { WeekSheet } from "./week-sheet";
import { dispatchWithUndoToast } from "../log/undo-toast";

export 
type Open = "week" | "off" | "shift" | null;

/** One person's weekly template and the days that differ from it. */
export function StaffSchedule({ person }: { person: Staff }) {
  const { state, today } = useStudio();
  const [open, setOpen] = useState<Open>(null);
  const exceptions = state.exceptions.filter((e) => e.staffId === person.id && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const close = () => setOpen(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">{t("schedule.week")}</p>
        <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => setOpen("week")}>{t("schedule.editWeek")}</Button>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-x-3 gap-y-2">
        {WEEK_ORDER.map((d) => {
          const shift = person.week[d];
          return (
            <div key={d}>
              <dt className="text-sm font-medium">{words.weekdaysShort[d]}</dt>
              <dd className="text-sm tabular-nums text-text-secondary">{shift ? `${formatTime(shift.start)}–${formatTime(shift.end)}` : t("calendar.off")}</dd>
            </div>
          );
        })}
      </dl>
      {exceptions.length > 0 && (
        <ul className="space-y-2">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{formatDayShort(e.date)}</span>{" "}
                <span className="text-text-secondary">{e.kind === "off" ? t(`schedule.reason.${e.reason}`) : t("schedule.shiftText", { from: formatTime(e.start), to: formatTime(e.end) })}</span>
              </span>
              <IconButton
                label={t("schedule.removeException", { day: formatDayShort(e.date) })}
                className="size-8"
                onClick={() => {
                  dispatchWithUndoToast({ type: "staff/exception-remove", id: e.id }, t("schedule.exceptionRemoved"));
                }}
              >
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<CalendarMinus size={16} />} onClick={() => setOpen("off")}>{t("schedule.markOff")}</Button>
        <Button size="sm" variant="secondary" icon={<CalendarClock size={16} />} onClick={() => setOpen("shift")}>{t("schedule.addShift")}</Button>
      </div>
      {open === "week" && <WeekSheet person={person} onClose={close} />}
      {open === "off" && <OffSheet person={person} onClose={close} />}
      {open === "shift" && <ShiftSheet person={person} onClose={close} />}
    </div>
  );
}
