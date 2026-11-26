"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, MessageCircle, Settings, UserRound, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "../../i18n";
import { useRole } from "../../ops/role";
import { cx } from "../../ui/cx";
import { Sheet } from "../../ui/sheet";
import { Button } from "../../ui/button";
import { SearchInput } from "../../ui/controls";
import { openAssistant, useThread } from "../assistant/thread-store";
import { isDateKey } from "../../data/dates";
import { requestCalendarDay } from "../calendar/show-day";
import { useStudio } from "../use-studio";
import { GROUP_ORDER, paletteResults, resolveRecent, type PaletteGroup, type PaletteItem } from "./palette-items";

const RECENT_KEY = "cresavo-search-recent";
const RECENT_LIMIT = 4;

// Open state lives outside React so the sidebar, the phone's quick actions and the shortcut share one palette.
let isOpen = false;
const listeners = new Set<() => void>();
const setOpen = (next: boolean) => {
  if (isOpen === next) return;
  isOpen = next;
  listeners.forEach((listener) => listener());
};
export const openSearch = () => setOpen(true);
// The field lives in the sheet body; the shortcut reads this so Ctrl+K can hand the words to the assistant.
let draftQuery = "";
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const useSearchOpen = () => useSyncExternalStore(subscribe, () => isOpen, () => false);

function readRecent(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  if (id === "assistant") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((old) => old !== id)].slice(0, RECENT_LIMIT)));
  } catch {
    // Recent then lasts only for this visit.
  }
}

const GROUP_TITLE: Record<PaletteGroup | "recent", MessageKey> = {
  recent: "palette.recent",
  customers: "palette.customers",
  days: "palette.days",
  places: "palette.places",
  settings: "palette.settings",
  assistant: "palette.assistant",
};

const GROUP_ICON: Record<PaletteGroup, LucideIcon> = {
  customers: UserRound,
  days: CalendarDays,
  places: LayoutGrid,
  settings: Settings,
  assistant: MessageCircle,
};

const noChange = () => () => {};
export const useMac = () => useSyncExternalStore(noChange, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);

/**
 * Ctrl+K (⌘K on a Mac) opens Search from anywhere in the studio. Pressed again while Search is open, it goes on
 * to the assistant, so the old way to the assistant keeps working; "Ask the assistant" is also the first result.
 */
function useShortcut(assistant: boolean, assistantOpen: boolean) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (assistantOpen) return;
      if (!isOpen) return openSearch();
      if (!assistant) return;
      const asked = draftQuery.trim();
      setOpen(false);
      openAssistant(asked ? { ask: asked } : {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assistant, assistantOpen]);
}

/** Search across the studio: customers, a day in the calendar, pages, settings and the assistant. */
export function SearchPalette() {
  const { state, today } = useStudio();
  const role = useRole();
  const open = useSearchOpen();
  const assistantOpen = useThread(role).open;
  useShortcut(state.modules.assistant, assistantOpen);
  // Each opening starts empty; the last search stays visible while the sheet folds away.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession(session + 1);
  }
  return <Sheet open={open} onClose={() => setOpen(false)} title={t("palette.title")}>
    <PaletteBody key={session} context={{ state, role, today }} />
  </Sheet>;
}

function PaletteBody({ context }: { context: Parameters<typeof paletteResults>[0] }) {
  const router = useRouter();
  useEffect(() => {
    draftQuery = "";
    return () => { draftQuery = ""; };
  }, []);
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const mac = useMac();
  const [recentIds] = useState(readRecent);

  const sections = useMemo(() => {
    const results = paletteResults(context, query);
    const recent = query.trim() ? [] : recentIds.map((recentId) => resolveRecent(context, recentId)).filter((item): item is PaletteItem => !!item);
    const shown = new Set(recent.map((item) => item.id));
    const list: { key: PaletteGroup | "recent"; items: PaletteItem[] }[] = [];
    // The assistant row stays first on an empty search, above Recent.
    const lead = !query.trim() && results[0]?.group === "assistant" ? [results[0]] : [];
    if (lead.length) list.push({ key: "assistant", items: lead });
    if (recent.length) list.push({ key: "recent", items: recent });
    for (const group of GROUP_ORDER) {
      const items = results.filter((item) => item.group === group && !shown.has(item.id) && !lead.includes(item));
      if (items.length) list.push({ key: group, items });
    }
    return list;
  }, [context, query, recentIds]);
  const flat = sections.flatMap((section) => section.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  // The dialog opens after this mounts; focus the field once it is showing.
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.getElementById(`${id}-input`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [id]);

  useEffect(() => {
    document.getElementById(`${id}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [id, current]);

  const run = (item: PaletteItem) => {
    remember(item.id);
    setOpen(false);
    if (item.href) {
      // Tell the calendar even when the ?date= link is already in the address (a soft replace
      // that should have dropped it can stay in flight, and router.push is then a no-op).
      const date = new URL(item.href, "http://local.invalid").searchParams.get("date");
      if (date && isDateKey(date)) requestCalendarDay(date);
      router.push(item.href);
    } else {
      openAssistant(query.trim() ? { ask: query.trim() } : {});
    }
  };

  let index = -1;
  return (
    <div className="flex flex-col">
      <div className="pb-2 pt-1">
        <SearchInput
          id={`${id}-input`}
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={flat.length ? `${id}-${current}` : undefined}
          aria-autocomplete="list"
          aria-label={t("palette.placeholder")}
          placeholder={t("palette.placeholder")}
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.target.value); draftQuery = event.target.value; setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!flat.length) return;
              setActive((current + (event.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
            } else if (event.key === "Enter" && flat[current]) {
              event.preventDefault();
              run(flat[current]);
            }
          }}
        />
      </div>

      {/* The list scrolls on its own so the field and the key hints stay put. */}
      <div id={`${id}-list`} role="listbox" aria-label={t("palette.title")} className="no-scrollbar max-h-96 min-h-0 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.key} role="group" aria-labelledby={`${id}-${section.key}`} className="pt-2">
            <p id={`${id}-${section.key}`} className="px-3 py-1 text-meta text-text-secondary">{t(GROUP_TITLE[section.key])}</p>
            {section.items.map((item) => {
              index += 1;
              const position = index;
              const Icon = GROUP_ICON[item.group];
              return (
                <div
                  key={item.id}
                  id={`${id}-${position}`}
                  role="option"
                  aria-selected={position === current}
                  onPointerMove={() => { if (position !== current) setActive(position); }}
                  onClick={() => run(item)}
                  className={cx("flex min-h-target cursor-pointer items-center gap-3 rounded-md px-3 py-2", position === current && "bg-surface-2")}
                >
                  <Icon size={18} aria-hidden className="shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">{item.label}</span>
                    {item.meta && <span className="block truncate text-meta text-text-secondary">{item.meta}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {!flat.length && (
          <div className="space-y-2 px-3 py-4">
            <p className="text-body">{t("palette.empty", { query: query.trim() })}</p>
            <Button variant="link" onClick={() => setQuery("")}>{t("palette.clear")}</Button>
          </div>
        )}
      </div>

      {/* The keys only matter with a keyboard; a phone gets the list alone. */}
      <p className="mt-2 hidden gap-4 border-t border-hairline pt-3 text-meta text-text-secondary sm:flex">
        <span><kbd className="font-sans">↑ ↓</kbd> {t("palette.hint.move")}</span>
        <span><kbd className="font-sans">↵</kbd> {t("palette.hint.open")}</span>
        <span><kbd className="font-sans">{t("palette.key.escape")}</kbd> {t("palette.hint.close")}</span>
        {context.state.modules.assistant && <span className="ml-auto">{t("palette.hint.assistant", { keys: t(mac ? "palette.shortcut.mac" : "palette.shortcut.pc") })}</span>}
      </p>
    </div>
  );
}
