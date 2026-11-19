import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-lg bg-surface ring-1 ring-hairline", className)} {...rest} />;
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
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="min-w-0 break-words text-h2 font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <dl><dt className="text-meta text-text-secondary">{label}</dt><dd className="text-h2 font-semibold">{value}</dd></dl>;
}
