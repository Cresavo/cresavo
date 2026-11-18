import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "./cx";

// A message that carries meaning (an error, a success, a warning), always on
// its paired semantic background so it reads on any page colour. The text is
// neutral ink; the tone is in the icon and the tint, never in same-hue text.
// `data-tone` lets tenant-theme.css protect it from a business's own CSS.
// Plain information is not a state: it sits on the neutral surface with a
// neutral mark, so a page of explanations stays calm.

export type NoticeTone = "danger" | "success" | "warning" | "info";

const tones: Record<NoticeTone, { ground: string; mark: string; icon: LucideIcon }> = {
  danger: { ground: "bg-danger-bg", mark: "text-danger", icon: CircleAlert },
  success: { ground: "bg-success-bg", mark: "text-success", icon: CircleCheck },
  warning: { ground: "bg-warning-bg", mark: "text-warning", icon: TriangleAlert },
  info: { ground: "bg-surface-2", mark: "text-text-secondary", icon: Info },
};

export function Notice({ tone, role, className, children }: { tone: NoticeTone; role?: "alert" | "status"; className?: string; children: ReactNode }) {
  const { ground, mark, icon: Icon } = tones[tone];
  return (
    <p role={role} data-tone={tone === "info" ? undefined : tone} className={cx("flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm text-text", ground, className)}>
      <Icon aria-hidden data-tone-mark={tone === "info" ? undefined : true} size={18} className={cx("mt-px shrink-0", mark)} />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}
