import { cx } from "./cx";

// Small dependency-free charts.

interface ColumnChartProps {
  data: { label: string; value: number; highlight?: boolean }[];
  format: (value: number) => string;
  label: string;
  height?: number;
}

/** Vertical columns with the value above each column. */
export function ColumnChart({ data, format, label, height = 160 }: ColumnChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure aria-label={label} className="w-full">
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="truncate text-[11px] font-medium tabular-nums text-eko-muted">{format(d.value)}</span>
            <div
              className={cx("w-full max-w-12 rounded-t-lg", d.highlight ? "bg-eko-accent" : "bg-eko-accent/25")}
              style={{ height: `${Math.max(3, (d.value / max) * (height - 28))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-eko-line pt-2 sm:gap-3">
        {data.map((d) => (
          <span key={d.label} className={cx("flex-1 text-center text-xs", d.highlight ? "font-semibold" : "text-eko-muted")}>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

interface BarListProps {
  data: { id: string; label: string; value: number; tone?: string }[];
  format: (value: number) => string;
}

/** Horizontal bars, one row per item. */
export function BarList({ data, format }: BarListProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.id} className="space-y-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{format(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-eko-sunken">
            <div className={cx("h-full rounded-full", d.tone ?? "bg-eko-accent")} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A thin progress bar, 0–1. */
export function Meter({ value, tone = "bg-eko-accent", className }: { value: number; tone?: string; className?: string }) {
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-eko-sunken", className)}>
      <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}
