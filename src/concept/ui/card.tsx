import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl bg-eko-surface shadow-card ring-1 ring-eko-line/70", className)} {...rest} />;
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block on a page. */
export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-eko-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
