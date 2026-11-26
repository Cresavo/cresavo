"use client";

import Link from "next/link";
import type { AnimationEvent, AriaAttributes, ReactNode } from "react";
import { cx } from "./cx";

type ListRowProps = Pick<AriaAttributes, "aria-label" | "aria-current" | "aria-describedby" | "aria-pressed"> & {
  title: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  motion?: "enter" | "exit";
  onExited?: () => void;
  className?: string;
  /** Name for the Help button's "Show me". */
  help?: string;
  /** Help-map id ("Show me" points here), see `src/concept/help/map`. */
  helpId?: string;
  /** What "Show me" may need to know about the row, such as whether a visit has finished. */
  helpState?: string;
} & ({ href: string; onClick?: never } | { onClick?: () => void; href?: never });

export function ListRow({ title, meta, leading, trailing, href, onClick, motion, onExited, className, help, helpId, helpState, ...aria }: ListRowProps) {
  const row = {
    ...aria,
    "data-help": help,
    "data-help-id": helpId,
    "data-help-state": helpState,
    "data-row-motion": motion,
    inert: motion === "exit" || undefined,
    onAnimationEnd: (event: AnimationEvent) => {
      if (motion === "exit" && event.target === event.currentTarget) onExited?.();
    },
    className: cx("ui-row flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md px-4 py-2 text-left", (href !== undefined || onClick) && "hover:bg-surface-2", className),
  };
  const content = <>
    {leading}
    <span className="min-w-0 flex-1 break-words">
      <span className="block text-body font-medium">{title}</span>
      {meta && <span className="block text-meta text-text-secondary">{meta}</span>}
    </span>
    {trailing}
  </>;
  if (href !== undefined) return <Link {...row} href={href}>{content}</Link>;
  if (onClick) return <button type="button" {...row} onClick={onClick}>{content}</button>;
  return <div {...row}>{content}</div>;
}
