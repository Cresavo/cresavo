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
            <span className="truncate text-[11px] font-medium tabular-nums text-text-secondary">{format(d.value)}</span>
            <div
              className={cx("w-full max-w-12 rounded-t-sm", d.highlight ? "bg-action" : "bg-action/25")}
              style={{ height: `${Math.max(3, (d.value / max) * (height - 28))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-border pt-2 sm:gap-3">
        {data.map((d) => (
          <span key={d.label} className={cx("flex-1 text-center text-xs", d.highlight ? "font-semibold" : "text-text-secondary")}>
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
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={cx("h-full rounded-full", d.tone ?? "bg-action")} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A thin progress bar, 0–1. */
export function Meter({ value, tone = "bg-action", className }: { value: number; tone?: string; className?: string }) {
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

interface PairedColumnsProps {
  data: { current: number; previous: number }[];
  /** Short text under the first and last column. */
  labels: [string, string];
  label: string;
  height?: number;
}

const STEP = 10;

/** Two thin columns per step, this period (dark) next to the one before (light). */
export function PairedColumns({ data, labels, label, height = 110 }: PairedColumnsProps) {
  const max = Math.max(1, ...data.flatMap((d) => [d.current, d.previous]));
  const bar = (value: number) => (value / max) * (height - 4);
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${data.length * STEP} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className="w-full" style={{ height }}>
        {data.map((d, i) => (
          <g key={i}>
            <rect x={i * STEP + 0.8} y={height - bar(d.previous)} width={4} height={bar(d.previous)} className="fill-action/25" />
            <rect x={i * STEP + 4.9} y={height - bar(d.current)} width={4} height={bar(d.current)} className="fill-action" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs text-text-secondary">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </figure>
  );
}

interface CompareBarsProps {
  data: { id: string; label: string; value: number; previous: number; tone?: string }[];
  format: (value: number) => string;
}

/** One row per item: a bar for this period with a thinner one below for the period before. */
export function CompareBars({ data, format }: CompareBarsProps) {
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.previous]));
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.id} className="space-y-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{format(d.value)}</span>
          </div>
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={cx("h-full rounded-full", d.tone ?? "bg-action")} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-text-secondary/40" style={{ width: `${(d.previous / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
