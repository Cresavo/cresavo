"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cx } from "./cx";

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; /** Name for the Help button's "Show me". */ help?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex max-w-full flex-wrap rounded-md bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          data-help={o.help}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-11 flex-1 whitespace-nowrap rounded-sm px-3 text-center text-[15px] font-medium transition-colors",
            o.value === value ? "bg-surface text-text ring-1 ring-input-border" : "text-text-secondary hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}

export function Chip({ active, onClick, children, count }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium ring-1 ring-inset transition-colors max-[299px]:shrink",
        active ? "bg-action-bg text-text ring-2 ring-action" : "bg-surface text-text ring-hairline hover:bg-surface-2",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("text-xs", active ? "text-text" : "text-text-secondary")}>{count}</span>}
    </button>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

/** A 48 × 28 track inside a 44 px tall target. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full">
      <span aria-hidden className={cx("relative inline-flex h-7 w-12 rounded-full ring-1 ring-inset transition-colors", checked ? "bg-action ring-action" : "bg-surface-2 ring-input-border")}>
        <span className={cx("absolute top-1 size-5 rounded-full transition-transform", checked ? "translate-x-[24px] bg-on-action" : "translate-x-1 bg-text-secondary")} />
      </span>
    </button>
  );
}

const fieldClass =
  "w-full rounded-md bg-surface px-3.5 py-2.5 text-base ring-1 ring-inset ring-input-border placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:bg-surface-2 disabled:text-text-secondary";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-secondary">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, "min-h-11", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, "min-h-24 resize-y leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldClass, "min-h-11 pr-3", className)} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx("relative", className)}>
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input type="search" className={cx(fieldClass, "min-h-11 pl-10")} {...rest} />
    </div>
  );
}
