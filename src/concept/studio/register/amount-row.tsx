import type { ReactNode } from "react";
import { cx } from "../../ui/cx";

/** A label and an amount on one line, for the register, its receipts and the daily report. Use inside a <dl>. */
export function AmountRow({ label, value, strong, className }: { label: string; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", strong && "font-semibold", className)}>
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}
