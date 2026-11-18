import type { ReactNode } from "react";
import { HeaderTools } from "./header-tools";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Back link or breadcrumb shown above the title. */
  back?: ReactNode;
}

/**
 * Page title row, used by every studio page: title on the left, the page's own actions and then the
 * assistant and Help on the right (desktop). The assistant is one button here (or Ctrl/Cmd+K), not a box on every page.
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-3">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 lg:flex-nowrap">
        <div className="min-w-0 lg:flex-1">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {actions}
          <HeaderTools />
        </div>
      </div>
    </header>
  );
}
