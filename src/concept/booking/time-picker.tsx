"use client";

import { useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { addDays, fromKey } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DateKey, DemoState } from "../data/types";
import { t } from "../i18n";
import { dayChipLabel, formatDayLong, formatTime } from "../i18n/format";
import { Button } from "../ui/button";
import { cx } from "../ui/cx";
import { openSlots, type Clock, type OpenSlot } from "./suggest";

const DAYS_SHOWN = 14;

interface TimePickerProps {
  state: DemoState;
  serviceId: string;
  clock: Clock;
  onPick: (slot: OpenSlot) => void;
  /** Called when the chosen day has no free time. */
  onWaitlist: (date: DateKey) => void;
  /** A booking being moved: its capacity is reusable, but its current time is excluded. */
  ignoreId?: string;
  /** Highlights the time the customer already tapped. */
  selected?: OpenSlot;
}

/** Two rows: pick a day, then a time. Full days say so and offer the waiting list. */
export function TimePicker({ state, serviceId, clock, onPick, onWaitlist, ignoreId, selected: picked }: TimePickerProps) {
  const current = state.bookings.find((booking) => booking.id === ignoreId);
  const days = useMemo(() => {
    const list: { date: DateKey; slots: OpenSlot[] }[] = [];
    for (let i = 0; list.length < DAYS_SHOWN && i < DAYS_SHOWN * 2; i++) {
      const date = addDays(clock.today, i);
      if (!openingFor(state.salon, date)) continue;
      const slots = openSlots(state, serviceId, date, clock, { ignoreId }).filter((slot) =>
        !current || date !== current.date || slot.start !== current.start);
      list.push({ date, slots });
    }
    return list;
  }, [state, serviceId, clock, ignoreId, current]);
  const [chosen, setChosen] = useState<DateKey>();
  const selected = days.find((d) => d.date === chosen) ?? days.find((d) => d.slots.length) ?? days[0];

  if (!selected) {
    const { phone, email } = state.salon;
    return (
      <div className="space-y-2 rounded-lg bg-surface-2 p-4">
        <p className="text-[15px]">{t("booking.noOpenDays")}</p>
        {(phone || email) && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-action">
            {phone && <a className="underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>}
            {email && <a className="underline [overflow-wrap:anywhere]" href={`mailto:${email}`}>{email}</a>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t("booking.pickDay")} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {days.map(({ date, slots }) => {
          const active = date === selected.date;
          return (
            <button
              key={date}
              role="radio"
              aria-checked={active}
              onClick={() => setChosen(date)}
              className={cx(
                "flex min-h-16 w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2 ring-1 ring-inset transition-colors",
                active ? "bg-action text-on-action ring-action" : "bg-surface ring-hairline hover:bg-surface-2",
                !slots.length && !active && "text-text-secondary",
              )}
            >
              <span className="text-xs font-medium">{dayChipLabel(date, clock.today)}</span>
              <span className="text-lg font-semibold leading-tight">{fromKey(date).getDate()}</span>
              <span className="text-[11px]">{slots.length ? t("booking.times", { count: slots.length }) : t("booking.full")}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-medium">{formatDayLong(selected.date)}</p>

      {selected.slots.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {selected.slots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onPick(slot)}
              aria-pressed={picked?.date === slot.date && picked.start === slot.start}
              className={cx(
                "flex min-h-12 items-center justify-center rounded-md text-[15px] font-medium ring-1 ring-inset transition-colors",
                picked?.date === slot.date && picked.start === slot.start
                  ? "bg-action text-on-action ring-action"
                  : "bg-surface ring-hairline hover:bg-action-bg hover:text-text hover:ring-action",
              )}
            >
              {formatTime(slot.start)}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg bg-surface-2 p-4">
          <p className="text-[15px]">{t("booking.dayFull", { day: formatDayLong(selected.date) })}</p>
          {state.modules.waitlist && (
            <Button variant="secondary" icon={<BellRing size={16} />} onClick={() => onWaitlist(selected.date)}>
              {t("booking.notifyMe")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
