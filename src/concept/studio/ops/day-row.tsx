"use client";

import type { ReactNode } from "react";
import { t } from "../../i18n";
import { Switch } from "../../ui/controls";
import { TimeField } from "./time-field";

/** One line of an hours editor: a name, an on/off switch and, when on, the times (below the name on phones). */
export function DayRow({ label, on, switchLabel, onToggle, children, off }: { label: string; on: boolean; switchLabel: string; onToggle: () => void; children: ReactNode; off: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[6rem_auto_1fr]">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={on} label={switchLabel} onChange={onToggle} />
      <div className="col-span-2 min-w-0 sm:col-span-1">{on ? children : <span className="hidden text-sm text-eko-muted sm:inline">{off}</span>}</div>
    </div>
  );
}

/** Two time fields: from and to, in minutes from midnight. `label` names the day for screen readers. */
export function TimeRange({ from, to, onChange, label }: { from: number; to: number; onChange: (from: number, to: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <TimeField label={t("hours.from", { day: label })} value={from} onChange={(start) => onChange(start, to)} />
      <span className="text-eko-muted">–</span>
      <TimeField label={t("hours.to", { day: label })} value={to} onChange={(end) => onChange(from, end)} />
    </div>
  );
}
