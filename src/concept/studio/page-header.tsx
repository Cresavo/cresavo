import type { ReactNode } from "react";
import { CommandBox } from "../command/command-box";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Back link or breadcrumb shown above the title. */
  back?: ReactNode;
}

/** Page title row followed by the command box. Used by every studio page. */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-4">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-eko-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <CommandBox />
    </header>
  );
}
