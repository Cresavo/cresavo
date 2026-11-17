import type { ReactNode } from "react";
import { cx } from "./cx";

// A message that carries meaning (an error, a success, a warning), always on
// its paired semantic background so it reads on any page colour. `data-tone`
// lets tenant-theme.css protect it from a business's own CSS.

export type NoticeTone = "danger" | "success" | "warning" | "info";

const tones: Record<NoticeTone, string> = {
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
};

export function Notice({ tone, role, className, children }: { tone: NoticeTone; role?: "alert" | "status"; className?: string; children: ReactNode }) {
  return (
    <p role={role} data-tone={tone} className={cx("rounded-md px-3.5 py-3 text-sm", tones[tone], className)}>
      {children}
    </p>
  );
}
