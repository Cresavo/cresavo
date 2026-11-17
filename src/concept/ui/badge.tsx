import type { ReactNode } from "react";
import { cx } from "./cx";

// Status pills. `accent` marks something as the product's own (selected, new);
// success/warn/danger/info carry meaning and never use the brand colours.
type Tone = "neutral" | "accent" | "success" | "info" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-secondary",
  accent: "bg-action-bg text-text",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  warn: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

const SEMANTIC: Partial<Record<Tone, string>> = { success: "success", info: "info", warn: "warning", danger: "danger" };

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span data-tone={SEMANTIC[tone]} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium max-[299px]:whitespace-normal", tones[tone], className)}>
      {children}
    </span>
  );
}
