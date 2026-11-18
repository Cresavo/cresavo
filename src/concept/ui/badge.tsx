import type { ReactNode } from "react";
import { cx } from "./cx";

// Status pills. Text is always neutral ink on the tint (never the tint's own
// hue); a semantic tone adds a solid dot in its colour, so the meaning is in
// the word and the dot. `accent` marks something as selected or current.
type Tone = "neutral" | "accent" | "success" | "info" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-secondary",
  accent: "bg-action-bg text-text",
  success: "bg-success-bg text-text",
  info: "bg-info-bg text-text",
  warn: "bg-warning-bg text-text",
  danger: "bg-danger-bg text-text",
};

const dots: Partial<Record<Tone, string>> = { success: "bg-success", info: "bg-info", warn: "bg-warning", danger: "bg-danger" };

const SEMANTIC: Partial<Record<Tone, string>> = { success: "success", info: "info", warn: "warning", danger: "danger" };

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span data-tone={SEMANTIC[tone]} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium max-[299px]:whitespace-normal", tones[tone], className)}>
      {dots[tone] && <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
