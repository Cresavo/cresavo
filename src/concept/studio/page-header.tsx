import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Back link or breadcrumb shown above the title. */
  back?: ReactNode;
}

/** Page title row, used by every studio page. The assistant is one button in the shell (or Ctrl/Cmd+K), not a box on every page. */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
