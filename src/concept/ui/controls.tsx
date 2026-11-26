"use client";

import { useId, useContext, createContext, type CSSProperties, type AriaAttributes } from "react";
import type { ComponentPropsWithRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cx } from "./cx";

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; content?: ReactNode; count?: number; /** Name for the Help button's "Show me". */ help?: string; /** Help-map id. */ helpId?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** Size each option to its label, for a row of collection filters. */
  fit?: boolean;
  /** Bare options with a short line under the selected one, for a utility such as the theme switch. */
  quiet?: boolean;
  /** Help-map id for the whole group. */
  helpId?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, className, fit, quiet, helpId }: SegmentedProps<T>) {
  const selectedIndex = options.findIndex(option => option.value === value);
  return (
    <div data-help-id={helpId} className={cx("inline-block w-fit min-w-0 max-w-full overflow-x-auto align-middle", !quiet && "rounded-md bg-surface-2 p-1", className)}>
      <div role="radiogroup" aria-label={label} data-unselected={selectedIndex < 0 || undefined} data-fit={fit || undefined} data-quiet={quiet || undefined} className="ui-segments" style={{
        "--segment-count": Math.max(1, options.length), "--segment-index": selectedIndex,
      } as CSSProperties}>
        {options.map((o, index) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            tabIndex={index === Math.max(0, selectedIndex) ? 0 : -1}
            aria-label={o.icon || o.content ? (o.count === undefined ? o.label : `${o.label} ${o.count}`) : undefined}
            title={o.icon ? o.label : undefined}
            data-help={o.help}
            data-help-id={o.helpId}
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
              "text-text-secondary hover:text-text",
            )}
          >
            {o.content ?? o.icon ?? o.label}
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
  options: { value: T; label: string; /** Optional cover photo shown above the label. */ image?: string }[];
  onChange: (value: T) => void;
  label: string;
}

/** Pick exactly one of a few choices as large tappable cards (a radio group with arrow-key movement). */
export function ChoiceCards<T extends string>({ value, options, onChange, label }: ChoiceCardsProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 min-[320px]:grid-cols-2 sm:grid-cols-3">
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
              "ui-press flex min-h-16 items-center justify-center rounded-lg text-center text-body font-medium ring-inset",
              o.image ? "flex-col overflow-hidden p-0 text-left" : "px-3 py-2",
              checked ? "bg-action-bg text-text ring-2 ring-action" : "bg-surface text-text ring-1 ring-input-border hover:bg-surface-2",
            )}
          >
            {o.image && (
              // A static file from /demo; nothing for the image optimiser to do.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.image} alt="" className="setup-cover h-24 w-full object-cover" />
            )}
            <span className={o.image ? "px-3 py-2" : undefined}>{o.label}</span>
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
  /** Layout only, such as `flex-1` in a row of equal chips. */
  className?: string;
}

export function Chip({ active, onClick, children, count, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        className,
        "inline-flex w-fit min-h-target min-w-target max-w-full items-center gap-2 rounded-full px-3 text-left text-body font-medium ring-1 ring-inset [overflow-wrap:anywhere]",
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
  showLabel?: boolean;
}

/** A 48 × 28 track inside a 44 px tall target. */
export function Switch({ checked, disabled, onChange, label, showLabel = false }: SwitchProps) {
  return (
    <button type="button" role="switch" disabled={disabled} aria-checked={checked} aria-label={label} onClick={onChange}
      className={cx("inline-flex min-h-target shrink-0 items-center rounded-full", showLabel ? "gap-2 px-2 text-body text-text" : "w-14 justify-center")}>
      {showLabel && label}
      <span aria-hidden className={cx("relative inline-flex h-7 w-12 shrink-0 rounded-full ring-1 ring-inset", checked ? "bg-action ring-action" : "bg-surface-2 ring-input-border")}>
        <span className={cx("absolute left-0 top-1 size-5 rounded-full transition-transform duration-normal ease-enter", checked ? "translate-x-6 bg-on-action" : "translate-x-1 bg-text-secondary")} />
      </span>
    </button>
  );
}

const fieldClass =
  "w-full min-w-0 rounded-md bg-surface px-3 py-2 text-body ring-1 ring-inset ring-input-border placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:bg-surface-2 disabled:text-text-secondary";

type FieldWidth = "number" | "date" | "short" | "full";
const fieldWidths: Record<FieldWidth, string> = {
  number: "md:max-w-field-number",
  date: "md:max-w-field-date",
  short: "md:max-w-field-short",
  full: "",
};

type FieldAria = Pick<AriaAttributes, "aria-describedby" | "aria-invalid">;
const FieldContext = createContext<FieldAria>({});

function useFieldAria(props: FieldAria) {
  const field = useContext(FieldContext);
  return {
    "aria-describedby": cx(props["aria-describedby"], field["aria-describedby"]) || undefined,
    "aria-invalid": field["aria-invalid"] ?? props["aria-invalid"],
  };
}

export function Field({ label, children, hint, error, width = "full" }: {
  label: string; children: ReactNode; hint?: string; error?: string; width?: FieldWidth;
}) {
  const id = useId();
  const hintId = hint ? id + "-hint" : undefined;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cx("w-full min-w-0 space-y-1 break-words", fieldWidths[width])}>
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

export function TextInput({ className, type, width = "full", ...rest }: Omit<ComponentPropsWithRef<"input">, "width"> & { width?: FieldWidth }) {
  const fieldAria = useFieldAria(rest);
  if (type === "hidden") return <input type={type} {...rest} />;
  const appearance = type === "radio" ? "size-4 shrink-0 accent-action" : cx(fieldClass, fieldWidths[width], "min-h-target", type === "color" && "cursor-pointer !p-1");
  return <input type={type} className={cx(appearance, className)} {...rest} {...fieldAria} />;
}

export function TextArea({ className, variant = "field", ...rest }: ComponentPropsWithRef<"textarea"> & { variant?: "field" | "composer" }) {
  return <textarea className={cx(
    variant === "composer"
      ? "ui-composer-input min-h-target min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-body placeholder:text-text-secondary"
      : cx(fieldClass, "min-h-24 resize-y leading-relaxed"),
    className,
  )} {...rest} {...useFieldAria(rest)} />;
}

export function Select({ className, children, width = "full", ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { width?: FieldWidth }) {
  return (
    <select className={cx(fieldClass, fieldWidths[width], "min-h-target pr-3", className)} {...rest} {...useFieldAria(rest)}>
      {children}
    </select>
  );
}

export function SearchInput({ className, endAction, ...rest }: InputHTMLAttributes<HTMLInputElement> & { endAction?: ReactNode }) {
  return (
    <span className={cx("relative block", className)}>
      <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input type="search" className={cx(fieldClass, "min-h-target pl-10", endAction ? "pr-12" : undefined)} {...rest} {...useFieldAria(rest)} />
      {endAction && <span className="absolute inset-y-0 right-0 flex items-center">{endAction}</span>}
    </span>
  );
}

export { TextInput as Input, TextArea as Textarea };
