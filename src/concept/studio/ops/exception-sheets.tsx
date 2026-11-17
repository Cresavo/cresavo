"use client";

import { useState } from "react";
import { addDays, diffDays } from "../../data/dates";
import type { DateKey, Staff, TimeOffReason } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Field, Segmented, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { TimeField } from "./time-field";

const REASONS: TimeOffReason[] = ["vacation", "sick", "other"];
const MAX_DAYS = 60;

function daysBetween(from: DateKey, to: DateKey): DateKey[] {
  const count = Math.min(MAX_DAYS, diffDays(to, from) + 1);
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(from, i));
}

/** Time off for one day or a range: vacation, sick day or something else. */
export function OffSheet({ person, onClose }: { person: Staff; onClose: () => void }) {
  const { today } = useStudio();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState<TimeOffReason>("vacation");
  const dates = daysBetween(from, to);
  const save = () => {
    if (dispatch({ type: "staff/off", staffId: person.id, dates, reason })) showToast(t("schedule.offSaved", { name: person.firstName }), { label: t("common.undo"), run: undo });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("schedule.offTitle", { name: person.firstName })}
      description={t("schedule.offText")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!dates.length} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("schedule.from")}>
            <TextInput type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} />
          </Field>
          <Field label={t("schedule.to")}>
            <TextInput type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Segmented<TimeOffReason> label={t("schedule.reason")} value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: t(`schedule.reason.${r}`) }))} />
      </div>
    </Sheet>
  );
}

/** A shift on one day that replaces the weekly template: an extra day or different hours. */
export function ShiftSheet({ person, onClose }: { person: Staff; onClose: () => void }) {
  const { today } = useStudio();
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(10 * 60);
  const [end, setEnd] = useState(14 * 60);
  const valid = !!date && start < end;
  const save = () => {
    if (dispatch({ type: "staff/shift", staffId: person.id, date, start, end })) {
      showToast(t("schedule.shiftSaved", { name: person.firstName }), { label: t("common.undo"), run: undo });
    }
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("schedule.shiftTitle", { name: person.firstName })}
      description={t("schedule.shiftHint")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t("schedule.date")}>
          <TextInput type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("schedule.shiftFrom")}>
            <TimeField label={t("schedule.shiftFrom")} value={start} onChange={setStart} />
          </Field>
          <Field label={t("schedule.shiftTo")}>
            <TimeField label={t("schedule.shiftTo")} value={end} onChange={setEnd} />
          </Field>
        </div>
        {!valid && <p className="text-sm text-danger">{t("hours.invalid")}</p>}
      </div>
    </Sheet>
  );
}
