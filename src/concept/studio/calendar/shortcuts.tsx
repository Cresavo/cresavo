"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { t, type MessageKey } from "../../i18n";
import { Popover } from "../../ui/popover";
import { calendarKey, stepThrough } from "./keys";

interface ShortcutsProps {
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** The period on screen, read out after a key changes it. */
  label: string;
}

const HELP: { keys: string[]; action: MessageKey }[] = [
  { keys: ["←", "K"], action: "calendar.keys.previous" },
  { keys: ["→", "J"], action: "calendar.keys.next" },
  { keys: ["T"], action: "calendar.keys.today" },
  { keys: ["↑", "↓"], action: "calendar.keys.step" },
  { keys: ["Enter"], action: "calendar.keys.open" },
  { keys: ["?"], action: "calendar.keys.help" },
];

/** The bookings on screen in time order: day first, then start, then the column they sit in. */
function bookingsOnScreen(): HTMLElement[] {
  const blocks = [...document.querySelectorAll<HTMLElement>("[data-calendar-booking]")].filter((block) => block.offsetParent !== null);
  return blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => (a.block.dataset.date ?? "").localeCompare(b.block.dataset.date ?? "") || Number(a.block.dataset.start) - Number(b.block.dataset.start) || a.index - b.index)
    .map(({ block }) => block);
}

/**
 * Keys for the calendar on a desktop: ← → or K J between days (or weeks), T for today, ↑ ↓ through the bookings,
 * Enter to open the one in focus, ? for this list. Keys with Cmd, Ctrl or Alt are left alone, so ⌘K stays Search.
 */
export function CalendarShortcuts({ onPrevious, onNext, onToday, label }: ShortcutsProps) {
  const help = useRef<HTMLSpanElement>(null);
  const actions = useRef({ onPrevious, onNext, onToday });
  useEffect(() => { actions.current = { onPrevious, onNext, onToday }; });
  // Only a change made from the keyboard is read out; the heading already shows it to everyone.
  const [fromKeys, setFromKeys] = useState(false);

  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const target = event.target instanceof Element && event.target !== document.body ? event.target : null;
      const action = calendarKey({ key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey, defaultPrevented: event.defaultPrevented, target });
      if (!action) return;
      if (action === "help") {
        // The list is for a desktop; on a narrow screen the key does nothing.
        if (!help.current?.offsetParent) return;
        event.preventDefault();
        const trigger = help.current.querySelector("button");
        trigger?.click();
        // The list has nothing to press, so focus goes to the list itself: Escape then closes it and returns to the button.
        requestAnimationFrame(() => {
          const panel = trigger?.getAttribute("aria-controls");
          if (trigger?.getAttribute("aria-expanded") === "true" && panel) document.getElementById(panel)?.focus({ preventScroll: true });
        });
        return;
      }
      if (action === "earlier" || action === "later") {
        // Up and down only move between bookings once one has focus; elsewhere they still scroll the page.
        const current = target?.closest<HTMLElement>("[data-calendar-booking]") ?? null;
        if (!current) return;
        event.preventDefault();
        const blocks = bookingsOnScreen();
        stepThrough(blocks, blocks.includes(current) ? current : null, action)?.focus();
        return;
      }
      event.preventDefault();
      setFromKeys(true);
      if (action === "previous") actions.current.onPrevious();
      else if (action === "next") actions.current.onNext();
      else actions.current.onToday();
    };
    const pointer = () => setFromKeys(false);
    window.addEventListener("keydown", press);
    window.addEventListener("pointerdown", pointer);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("pointerdown", pointer);
    };
  }, []);

  return (
    <>
      <span ref={help} className="hidden lg:inline-flex">
        <Popover title={t("calendar.keys.title")} icon={<Keyboard size={20} aria-hidden />}>
          <dl className="w-72 space-y-2 text-meta">
            {HELP.map(({ keys, action }) => (
              <div key={action} className="flex items-baseline justify-between gap-4">
                <dt className="text-text-secondary">{t(action)}</dt>
                <dd className="flex shrink-0 gap-2">
                  {keys.map((key) => <kbd key={key} className="font-sans font-semibold text-text">{key}</kbd>)}
                </dd>
              </div>
            ))}
          </dl>
        </Popover>
      </span>
      <span role="status" className="sr-only">{fromKeys ? label : ""}</span>
    </>
  );
}
