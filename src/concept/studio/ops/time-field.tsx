"use client";

import { formatTime } from "../../data/dates";
import { Select } from "../../ui/controls";

const STEP = 15;
const TIMES = Array.from({ length: (24 * 60) / STEP + 1 }, (_, i) => i * STEP);

/** A time of day in 15-minute steps, always shown on the 24-hour clock (a native time field follows the browser's 12-hour setting). */
export function TimeField({ value, onChange, label }: { value: number; onChange: (minutes: number) => void; label: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1">
      {!TIMES.includes(value) && <option value={value}>{formatTime(value)}</option>}
      {TIMES.map((minutes) => (
        <option key={minutes} value={minutes}>{formatTime(minutes)}</option>
      ))}
    </Select>
  );
}
