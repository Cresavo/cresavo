"use client";

import { useMemo, useState } from "react";
import { BellRing, CalendarDays } from "lucide-react";
import { addDays, fromKey } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { t } from "../i18n";
import { dayChipLabel, formatDayLong, formatTime } from "../i18n/format";
import { Button } from "../ui/button";
import { SegmentedControl, Select } from "../ui/controls";
import { EmptyState } from "../ui/empty-state";
import { openSlots, type Clock, type OpenSlot } from "./suggest";

const DAYS_SHOWN = 14;

interface TimePickerProps {
  state: DemoState;
  serviceId: string;
  staffId?: StaffId;
  clock: Clock;
  onPick: (slot: OpenSlot) => void;
  /** Called when the chosen day has no free time. */
  onWaitlist: (date: DateKey) => void;
  /** A booking being moved: its capacity is reusable, but its current time is excluded. */
  ignoreId?: string;
  disabled?: boolean;
}

function availableDays(state: DemoState, serviceId: string, clock: Clock, staffId?: StaffId, ignoreId?: string) {
  const current = ignoreId ? state.bookings.find(booking => booking.id === ignoreId) : undefined;
  const list: { date: DateKey; slots: OpenSlot[] }[] = [];
  for (let i = 0; list.length < DAYS_SHOWN && i < DAYS_SHOWN * 2; i++) {
    const date = addDays(clock.today, i);
    if (!openingFor(state.salon, date)) continue;
    const slots = openSlots(state, serviceId, date, clock, { ignoreId, staffId }).filter((slot) =>
      !current || date !== current.date || slot.start !== current.start);
    list.push({ date, slots });
  }
  return list;
}

/** A single native chooser keeps alternative dates reachable from the contact form. */
export function OtherTimes({ state, serviceId, staffId, clock, selected, onPick, onWaitlist }: TimePickerProps & { selected?: OpenSlot }) {
  const days = useMemo(() => availableDays(state, serviceId, clock, staffId), [state, serviceId, clock, staffId]);
  return (
    <Select aria-label={t("booking.changeTime")} value={selected ? `${selected.date}/${selected.start}` : ""} onChange={event => {
      const [date, time] = event.target.value.split("/");
      const slot = days.find(day => day.date === date)?.slots.find(slot => slot.start === Number(time));
      if (time === "wait") onWaitlist(date);
      else if (slot) onPick(slot);
    }}>
      <option value="" disabled>{t("booking.changeTime")}</option>
      {days.map(({ date, slots }) => (
        <optgroup key={date} label={formatDayLong(date)}>
          {slots.map(slot => <option key={slot.start} value={`${date}/${slot.start}`}>
            {t("booking.slotOption", { time: formatTime(slot.start), staff: state.staff.find(person => person.id === slot.staffId)?.firstName ?? "" })}
          </option>)}
          {!slots.length && <option value={`${date}/wait`} disabled={!state.modules.waitlist}>
            {t(state.modules.waitlist ? "booking.notifyMe" : "booking.full")}
          </option>}
        </optgroup>
      ))}
    </Select>
  );
}

/** Two rows: pick a day, then a time. Full days say so and offer the waiting list. */
export function TimePicker({ state, serviceId, staffId, clock, onPick, onWaitlist, ignoreId, disabled }: TimePickerProps) {
  const days = useMemo(() => availableDays(state, serviceId, clock, staffId, ignoreId), [state, serviceId, clock, staffId, ignoreId]);
  const [chosen, setChosen] = useState<DateKey>();
  const selected = days.find((d) => d.date === chosen) ?? days.find((d) => d.slots.length) ?? days[0];

  if (!selected) {
    const { phone, email } = state.salon;
    return (
      <EmptyState icon={<CalendarDays size={22} aria-hidden />} title={t("booking.noOpenDays")} action={(phone || email) && (
        <div className="flex flex-wrap justify-center gap-x-4 text-meta text-action">
          {phone && <a className="inline-flex min-h-target items-center underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>}
          {email && <a className="inline-flex min-h-target items-center underline [overflow-wrap:anywhere]" href={`mailto:${email}`}>{email}</a>}
        </div>
      )} />
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl label={t("booking.pickDay")} value={selected.date} onChange={setChosen} options={days.map(({ date, slots }) => {
        const day = dayChipLabel(date, clock.today);
        const number = fromKey(date).getDate();
        const availability = slots.length ? t("booking.times", { count: slots.length }) : t("booking.full");
        return {
          value: date,
          label: `${day} ${number} ${availability}`,
          content: <span className="flex flex-col py-2 text-meta">
            <span>{day}</span>
            <span className="text-h3 font-semibold">{number}</span>
            <span>{availability}</span>
          </span>,
        };
      })} />

      <p className="text-meta font-medium">{formatDayLong(selected.date)}</p>

      {selected.slots.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {selected.slots.map((slot) => (
            <Button
              key={slot.start}
              variant="secondary"
              size="sm"
              onClick={() => onPick(slot)}
              disabled={disabled}
              className="flex-col !gap-1 !px-2"
            >
              {ignoreId ? <>
                {t("booking.move.confirm", { when: formatTime(slot.start) })}
                <span className="text-meta text-text-secondary">{state.staff.find(person => person.id === slot.staffId)?.firstName}</span>
              </> : formatTime(slot.start)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg bg-surface-2 p-4">
          <p className="text-body">{t("booking.dayFull", { day: formatDayLong(selected.date) })}</p>
          {state.modules.waitlist && (
            <Button icon={<BellRing size={16} />} onClick={() => onWaitlist(selected.date)}>
              {t("booking.notifyMe")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
