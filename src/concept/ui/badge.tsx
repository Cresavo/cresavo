import type { ReactNode } from "react";
import { cx } from "./cx";

// Status words, kept quiet. The default is plain secondary text: no fill, no
// dot, no pill. `accent` is the same text in the primary ink, for the one
// state on a row that is current ("Now", "Connected"). Only a status that
// needs attention (`warn`, `danger`) gets a signal, and exactly one: its
// semantic colour on the text, never a tinted fill behind it.
// `data-status` lets tenant-theme.css keep that colour on a business's page.
type Tone = "neutral" | "accent" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "text-text-secondary",
  accent: "font-medium text-text",
  warn: "font-medium text-warning",
  danger: "font-medium text-danger",
};

const STATUS: Partial<Record<Tone, string>> = { warn: "warning", danger: "danger" };

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span data-status={STATUS[tone]} className={cx("inline-flex items-center gap-1 whitespace-nowrap text-[13px] leading-5 max-[299px]:whitespace-normal", tones[tone], className)}>
      {children}
    </span>
  );
}

/** A label that is not a status (a customer's tag): a hairline outline with neutral text, no fill. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-text ring-1 ring-inset ring-hairline", className)}>{children}</span>;
}
