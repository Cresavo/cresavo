import { useId } from "react";
import { t } from "../i18n";
import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <span role="status" className={cx("ui-skeleton block min-h-target rounded-md bg-surface-2", className)}>
    <span className="sr-only">{t("ui.loading")}</span>
  </span>;
}

export function SuccessCheck() {
  const id = useId();
  return (
    <svg role="img" aria-label={t("ui.success")} viewBox="0 0 24 24" width="24" height="24" className="text-success">
      <defs><clipPath id={id}><rect className="ui-check" width="24" height="24" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
