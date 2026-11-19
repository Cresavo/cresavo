"use client";

import { useId, useContext, createContext, type CSSProperties, type AriaAttributes } from "react";
import type { ComponentPropsWithRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cx } from "./cx";

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; count?: number; /** Name for the Help button's "Show me". */ help?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, className }: SegmentedProps<T>) {
  const selectedIndex = options.findIndex(option => option.value === value);
  return (
    <div className={cx("inline-block min-w-0 max-w-full overflow-x-auto rounded-md bg-surface-2 p-1 align-middle", className)}>
      <div role="radiogroup" aria-label={label} data-unselected={selectedIndex < 0 || undefined} className="ui-segments" style={{
        "--segment-count": Math.max(1, options.length), "--segment-index": selectedIndex,
      } as CSSProperties}>
        {options.map((o, index) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            tabIndex={index === Math.max(0, selectedIndex) ? 0 : -1}
            aria-label={o.icon ? (o.count === undefined ? o.label : `${o.label} ${o.count}`) : undefined}
            title={o.icon ? o.label : undefined}
            data-help={o.help}
            onClick={() => onChange(o.value)}
            onKeyDown={(event) => {
              const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
              const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
              if (!forward && !backward) return;
              event.preventDefault();
              const next = (index + (forward ? 1 : -1) + options.length) % options.length;
              const buttons = event.currentTarget.parentElement?.querySelectorAll("button");
              buttons?.[next]?.focus();
              onChange(options[next].value);
            }}
            className={cx(
              "inline-flex min-h-target min-w-target items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 text-body font-medium",
              o.value === value ? "text-on-action" : "text-text-secondary hover:text-text",
            )}
          >
            {o.icon ?? o.label}
            {o.count !== undefined && <span className="text-meta">{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export { Segmented as SegmentedControl };

interface ChoiceCardsProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

/** Pick exactly one of a few choices as large tappable cards (a radio group with arrow-key movement). */
export function ChoiceCards<T extends string>({ value, options, onChange, label }: ChoiceCardsProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o, index) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(event) => {
              const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
              const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
              if (!forward && !backward) return;
              event.preventDefault();
              const next = (index + (forward ? 1 : -1) + options.length) % options.length;
              event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
              onChange(options[next].value);
            }}
            className={cx(
              "ui-press flex min-h-16 items-center justify-center rounded-lg px-3 py-2 text-center text-body font-medium ring-inset",
              checked ? "bg-action-bg text-text ring-2 ring-action" : "bg-surface text-text ring-1 ring-input-border hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
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
        "inline-flex min-h-target min-w-target shrink-0 items-center gap-2 rounded-full px-3 text-body font-medium ring-1 ring-inset max-[299px]:shrink",
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
  disabled?: boolean;
  onChange: () => void;
  label: string;
}

/** A 48 × 28 track inside a 44 px tall target. */
export function Switch({ checked, disabled, onChange, label }: SwitchProps) {
  return (
    <button type="button" role="switch" disabled={disabled} aria-checked={checked} aria-label={label} onClick={onChange} className="inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full">
      <span aria-hidden className={cx("relative inline-flex h-7 w-12 rounded-full ring-1 ring-inset", checked ? "bg-action ring-action" : "bg-surface-2 ring-input-border")}>
        <span className={cx("absolute left-0 top-1 size-5 rounded-full transition-transform duration-normal ease-enter", checked ? "translate-x-6 bg-on-action" : "translate-x-1 bg-text-secondary")} />
      </span>
    </button>
  );
}

const fieldClass =
  "w-full rounded-md bg-surface px-3 py-2 text-body ring-1 ring-inset ring-input-border placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:bg-surface-2 disabled:text-text-secondary";

type FieldAria = Pick<AriaAttributes, "aria-describedby" | "aria-invalid">;
const FieldContext = createContext<FieldAria>({});

function useFieldAria(props: FieldAria) {
  const field = useContext(FieldContext);
  return {
    "aria-describedby": cx(props["aria-describedby"], field["aria-describedby"]) || undefined,
    "aria-invalid": field["aria-invalid"] ?? props["aria-invalid"],
  };
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  const id = useId();
  const hintId = hint ? id + "-hint" : undefined;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className="space-y-1">
      <label className="block space-y-1">
        <span className="block text-body font-medium">{label}</span>
        <FieldContext.Provider value={{ "aria-describedby": cx(hintId, errorId), "aria-invalid": error ? true : undefined }}>
          {children}
        </FieldContext.Provider>
      </label>
      {hint && <p id={hintId} className="text-meta text-text-secondary">{hint}</p>}
      {error && <p id={errorId} className="text-meta text-danger">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { label: string }) {
  return (
    <label className="flex min-h-target cursor-pointer items-center gap-3 text-body">
      <input {...rest} {...useFieldAria(rest)} type="checkbox" className="size-4 shrink-0 accent-action" />
      {label}
    </label>
  );
}

export function TextInput({ className, type, ...rest }: ComponentPropsWithRef<"input">) {
  return <input type={type} className={cx(fieldClass, "min-h-target", type === "color" && "cursor-pointer !p-1", className)} {...rest} {...useFieldAria(rest)} />;
}

export function TextArea({ className, variant = "field", ...rest }: ComponentPropsWithRef<"textarea"> & { variant?: "field" | "composer" }) {
  return <textarea className={cx(
    variant === "composer"
      ? "ui-composer-input min-h-target min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-body placeholder:text-text-secondary"
      : cx(fieldClass, "min-h-24 resize-y leading-relaxed"),
    className,
  )} {...rest} {...useFieldAria(rest)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldClass, "min-h-target pr-3", className)} {...rest} {...useFieldAria(rest)}>
      {children}
    </select>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cx("relative block", className)}>
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input type="search" className={cx(fieldClass, "min-h-target pl-10")} {...rest} {...useFieldAria(rest)} />
    </span>
  );
}

export { TextInput as Input, TextArea as Textarea };
