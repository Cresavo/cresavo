import { CircleAlert, CircleCheck, FlaskConical, Info, TriangleAlert } from "lucide-react";
import { t } from "../i18n";
import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "neutral" | "accent" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "text-text-secondary",
  accent: "font-medium text-text",
  warn: "font-medium text-warning",
  danger: "font-medium text-danger",
};

const STATUS: Partial<Record<Tone, string>> = { warn: "warning", danger: "danger" };

const icons = { neutral: Info, accent: CircleCheck, warn: TriangleAlert, danger: CircleAlert };

export function Badge({ tone = "neutral", icon: Icon = icons[tone], children, className }: { tone?: Tone; icon?: typeof Info; children: ReactNode; className?: string }) {
  return (
    <span data-status={STATUS[tone]} className={cx("inline-flex items-center gap-1 text-meta", tones[tone], className)}>
      <Icon size={16} aria-hidden className="shrink-0" />
      {children}
    </span>
  );
}

/** A label that is not a status (a customer's tag): a hairline outline with neutral text, no fill. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-text ring-1 ring-inset ring-hairline", className)}>{children}</span>;
}

/** Marks simulated activity. `short` shows one word where space is tight; the full sentence stays its accessible name. */
export function DemoBadge({ short = false }: { short?: boolean }) {
  if (!short) return <Badge icon={FlaskConical}>{t("ui.demo")}</Badge>;
  return (
    <Badge icon={FlaskConical} className="shrink-0">
      <span aria-hidden className="max-[299px]:hidden">{t("ui.demoShort")}</span>
      <span className="sr-only">{t("ui.demo")}</span>
    </Badge>
  );
}
