"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { IconButton } from "./button";
import { cx } from "./cx";
import { Sheet } from "./sheet";

interface PopoverProps {
  /** Names the panel; on a phone it is also the sheet's title. */
  title: string;
  /** The icon button that opens the panel: its icon and, when it is not the quiet tertiary one, its variant. */
  icon: ReactNode;
  variant?: "secondary" | "tertiary";
  /** The panel's content. A menu item, or any element marked `data-popover-close`, closes the panel when chosen. */
  children: ReactNode;
  /** The edge the panel lines up with. It flips when that side has no room. */
  align?: "start" | "end";
  /** Below `sm` the panel becomes the bottom sheet, which has room for controls and is in reach of a thumb. */
  sheetOnPhone?: boolean;
  kind?: "menu" | "dialog";
}

const PHONE = "(max-width: 639.98px)";
const FOCUSABLE = "[role=menuitem], button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
const EDGE = 16;

const GAP = 8;

/** Place a panel under a trigger, flipping the side when needed and clamping it inside the viewport. */
export function popoverPlacement(
  align: "start" | "end",
  trigger: { left: number; right: number },
  width: number,
  viewportWidth: number,
): { side: "start" | "end"; left: number; width: number } {
  const room = Math.max(0, viewportWidth - EDGE * 2);
  const used = Math.min(width, room);
  const fitsEnd = trigger.right - used >= EDGE;
  const fitsStart = trigger.left + used <= viewportWidth - EDGE;
  const side = align === "end" ? (fitsEnd || !fitsStart ? "end" : "start") : (fitsStart || !fitsEnd ? "start" : "end");
  const desired = side === "end" ? trigger.right - used : trigger.left;
  const left = Math.min(Math.max(desired, EDGE), EDGE + Math.max(0, room - used));
  return { side, left, width: used };
}

/** Sit the panel below the trigger, or above it when there is more room there, and cap its height. */
export function popoverStack(
  trigger: { top: number; bottom: number },
  height: number,
  viewportHeight: number,
  gap = GAP,
): { placement: "below" | "above"; top: number; height: number } {
  const belowRoom = Math.max(0, viewportHeight - EDGE - (trigger.bottom + gap));
  const aboveRoom = Math.max(0, trigger.top - gap - EDGE);
  const placement = belowRoom >= height || belowRoom >= aboveRoom ? "below" : "above";
  const room = placement === "below" ? belowRoom : aboveRoom;
  const used = Math.min(height, room);
  const top = placement === "below" ? trigger.bottom + gap : trigger.top - gap - used;
  return { placement, top, height: used };
}

function watchPhone(listener: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function usePhone(enabled: boolean): boolean {
  return useSyncExternalStore(watchPhone, () => enabled && window.matchMedia(PHONE).matches, () => false);
}

/**
 * A short panel that grows out of the button that opened it and folds back into it. Escape, a click outside or
 * moving focus away closes it; Escape and a choice return focus to the trigger.
 */
export function Popover({ title, icon, variant = "tertiary", children, align = "end", sheetOnPhone = false, kind = "dialog" }: PopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [side, setSide] = useState(align);
  const [stack, setStack] = useState<"below" | "above">("below");
  const phone = usePhone(sheetOnPhone);
  if (open && !present && !phone) setPresent(true);
  if (phone && present) setPresent(false);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };

  // Line up with the preferred edge, flip when that side has no room, and clamp when neither edge fits.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = triggerRef.current;
    const wrap = wrapRef.current;
    if (!open || !present || !panel || !button || !wrap) return;
    const box = button.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    const place = popoverPlacement(align, box, panel.offsetWidth, window.innerWidth);
    const stackPlace = popoverStack(box, panel.offsetHeight, window.innerHeight);
    setSide(place.side);
    setStack(stackPlace.placement);
    panel.style.left = `${place.left - wrapBox.left}px`;
    panel.style.right = "auto";
    panel.style.width = `${place.width}px`;
    panel.style.top = `${stackPlace.top - wrapBox.top}px`;
    panel.style.height = `${stackPlace.height}px`;
    panel.style.bottom = "auto";
  }, [open, present, align]);

  useEffect(() => {
    if (phone || !open || !present) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, present, phone]);

  // Stay mounted through the exit so the panel folds back into the trigger before it goes.
  useEffect(() => {
    const panel = panelRef.current;
    if (open || !present) return;
    let cancelled = false;
    Promise.allSettled(panel?.getAnimations?.().map(animation => animation.finished) ?? []).then(() => {
      if (!cancelled) setPresent(false);
    });
    return () => { cancelled = true; };
  }, [open, present]);

  // A choice closes the panel after its own click handler has run.
  const chosen = (event: MouseEvent, done: () => void) => {
    if ((event.target as Element).closest("[role=menuitem], [data-popover-close]")) done();
  };
  const button = (
    <IconButton ref={triggerRef} label={title} variant={variant} aria-haspopup={kind} aria-expanded={open}
      aria-controls={present ? id : undefined} onClick={() => (open ? close() : setOpen(true))}>
      {icon}
    </IconButton>
  );

  if (phone) {
    return <>
      {button}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div onClick={event => chosen(event, () => setOpen(false))}>{children}</div>
      </Sheet>
    </>;
  }

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        close();
      }}
      onBlur={event => {
        // Tabbing away closes; a click elsewhere is the pointer listener's (Safari does not focus a clicked button).
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) close(false);
      }}
    >
      {button}
      {present && (
        <div
          ref={panelRef}
          id={id}
          // A click on the panel's own padding keeps focus inside, so it does not count as leaving.
          tabIndex={-1}
          role={kind === "menu" ? "menu" : "dialog"}
          aria-label={title}
          data-side={side}
          data-stack={stack}
          data-closing={!open || undefined}
          inert={!open}
          className={cx("ui-pop absolute left-0 z-popover overflow-y-auto outline-none min-w-56 rounded-lg border border-hairline bg-surface text-text shadow-raised", kind === "menu" ? "py-1" : "p-4")}
          onKeyDown={kind === "menu" ? moveInMenu : undefined}
          onClick={event => chosen(event, close)}
        >
          {children}
        </div>
      )}
    </span>
  );
}

function moveInMenu(event: KeyboardEvent<HTMLDivElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const last = items.length - 1;
  const next = ({ ArrowDown: index >= last ? 0 : index + 1, ArrowUp: index <= 0 ? last : index - 1, Home: 0, End: last } as Record<string, number>)[event.key];
  if (next === undefined) return;
  event.preventDefault();
  items[next]?.focus();
}

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  run: () => void;
}

/** A short list of actions that grows from its trigger. Arrow keys, Home and End move between the actions. */
export function ActionMenu({ title, icon, items, align }: {
  title: string;
  icon: ReactNode;
  items: readonly ActionMenuItem[];
  align?: PopoverProps["align"];
}) {
  return (
    <Popover title={title} icon={icon} align={align} kind="menu">
      {items.map(item => (
        <button key={item.label} type="button" role="menuitem" tabIndex={-1}
          className="flex min-h-target w-full items-center gap-3 px-4 py-2 text-left text-body font-medium hover:bg-surface-2 focus-visible:bg-surface-2"
          onClick={item.run}>
          {item.icon}
          <span className="min-w-0 flex-1 break-words">{item.label}</span>
        </button>
      ))}
    </Popover>
  );
}
