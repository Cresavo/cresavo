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
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-xl bg-eko-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          data-help={o.help}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-center text-sm font-medium transition-colors",
            o.value === value ? "bg-eko-surface text-eko-ink shadow-card" : "text-eko-muted hover:text-eko-ink",
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
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors",
        active ? "bg-eko-ink text-eko-bg ring-eko-ink" : "bg-eko-surface text-eko-ink ring-eko-line hover:bg-eko-sunken",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("text-xs", active ? "opacity-70" : "text-eko-muted")}>{count}</span>}
    </button>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cx("relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-eko-accent" : "bg-eko-line")}
    >
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

const fieldClass =
  "w-full rounded-xl bg-eko-surface px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-eko-line placeholder:text-eko-muted focus:outline-none focus:ring-2 focus:ring-eko-accent";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-eko-muted">{hint}</span>}
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
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-eko-muted" />
      <input type="search" className={cx(fieldClass, "min-h-11 pl-10")} {...rest} />
    </div>
  );
}
