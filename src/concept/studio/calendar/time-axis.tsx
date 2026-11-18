import { formatTime } from "../../data/dates";

/** Hour labels down the left side of a calendar grid. */
export function TimeAxis({ from, to, pxPerMin }: { from: number; to: number; pxPerMin: number }) {
  const hours: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) hours.push(m);
  return (
    <div className="relative w-11 shrink-0" style={{ height: (to - from) * pxPerMin }}>
      {hours.map((m) => (
        <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-text-secondary" style={{ top: (m - from) * pxPerMin }}>
          {formatTime(m)}
        </span>
      ))}
    </div>
  );
}

/** Horizontal hour lines behind a column. */
export function HourLines({ from, to, pxPerMin }: { from: number; to: number; pxPerMin: number }) {
  const lines: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) lines.push(m);
  return (
    <>
      {lines.map((m) => (
        <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-hairline" style={{ top: (m - from) * pxPerMin }} />
      ))}
    </>
  );
}
