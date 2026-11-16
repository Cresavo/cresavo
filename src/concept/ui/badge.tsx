import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "neutral" | "accent" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-eko-sunken text-eko-muted",
  accent: "bg-eko-accent-soft text-eko-accent",
  warn: "bg-eko-warn-soft text-eko-warn",
  danger: "bg-eko-danger-soft text-eko-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
