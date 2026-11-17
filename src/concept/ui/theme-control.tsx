"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { t } from "../i18n";
import { Segmented } from "./controls";
import { cx } from "./cx";
import { parseTheme, pinThemeColor, studioChrome, THEME_STORAGE_KEY, THEMES, type ThemePreference } from "./theme";

const EVENT = "ui-theme-change";

function setTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  pinThemeColor(studioChrome(theme));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (listener: () => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => parseTheme(document.documentElement.dataset.theme), () => "system");
}

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Light, dark or system. `compact` shows icons only (with names for screen readers), for the shell. */
export function ThemeControl({ compact = false, className }: { compact?: boolean; className?: string }) {
  const theme = useThemePreference();
  if (!compact) {
    return <Segmented label={t("theme.label")} value={theme} onChange={setTheme} options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))} className={className} />;
  }
  return (
    <div role="radiogroup" aria-label={t("theme.label")} className={cx("inline-flex rounded-md border border-border p-0.5", className)}>
      {THEMES.map((value) => {
        const Icon = ICONS[value];
        const active = value === theme;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`theme.${value}`)}
            title={t(`theme.${value}`)}
            onClick={() => setTheme(value)}
            className={cx("flex size-11 items-center justify-center rounded-sm", active ? "bg-action-bg text-text ring-1 ring-inset ring-input-border" : "text-text-secondary hover:text-text")}
          >
            <Icon size={18} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
