"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A heading that takes focus when it appears, so keyboard and screen reader users land on the new step.
 * `focus={false}` when the step focuses its first field instead.
 */
export function StepHeading({ level = 2, focus = true, id, children }: { level?: 1 | 2; focus?: boolean; id?: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, [focus]);
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag ref={ref} id={id} tabIndex={-1} className={level === 1 ? "text-h1 font-semibold tracking-tight outline-none" : "text-h2 font-semibold outline-none"}>
      {children}
    </Tag>
  );
}
