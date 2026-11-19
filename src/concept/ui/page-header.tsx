import type { ReactNode, Ref } from "react";
import { Button } from "./button";

export interface PageHeaderProps {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  subtitle?: string;
  back?: ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** Secondary tools and existing studio actions. */
  actions?: ReactNode;
}

export function PageHeader({ title, titleRef, subtitle, actions, primaryAction, back }: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-3">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 break-words">
          <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-h1 font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
        </div>
        {(primaryAction || actions) && <div className="flex max-w-full flex-wrap items-center gap-2">
          {primaryAction && <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button>}
          {actions}
        </div>}
      </div>
    </header>
  );
}
