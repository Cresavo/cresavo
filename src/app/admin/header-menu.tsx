"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
export default function HeaderMenu({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details
      ref={ref}
      className="workspace-menu"
      data-active={active || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          event.preventDefault();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="workspace-menu-panel">{children}</div>
    </details>
  );
}
