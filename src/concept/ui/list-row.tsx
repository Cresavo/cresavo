"use client";

import Link from "next/link";
import type { AnimationEvent, ReactNode } from "react";

type ListRowProps = {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  motion?: "enter" | "exit";
  onExited?: () => void;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function ListRow({ title, meta, leading, trailing, href, onClick, motion, onExited }: ListRowProps) {
  const row = {
    "data-row-motion": motion,
    inert: motion === "exit" || undefined,
    onAnimationEnd: (event: AnimationEvent) => {
      if (motion === "exit" && event.target === event.currentTarget) onExited?.();
    },
    className: "flex min-h-14 w-full items-center gap-3 rounded-md px-4 py-2 text-left hover:bg-surface-2",
  };
  const content = <>
    {leading}
    <span className="min-w-0 flex-1 break-words">
      <span className="block text-body font-medium">{title}</span>
      {meta && <span className="block text-meta text-text-secondary">{meta}</span>}
    </span>
    {trailing}
  </>;
  return href !== undefined
    ? <Link {...row} href={href}>{content}</Link>
    : <button type="button" {...row} onClick={onClick}>{content}</button>;
}
