"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { t } from "../i18n";
import { Segmented } from "./controls";
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
  return (
    <Segmented label={t("theme.label")} value={theme} onChange={setTheme} className={className}
      options={THEMES.map(value => {
        const Icon = ICONS[value];
        return { value, label: t(`theme.${value}`), icon: compact ? <Icon size={18} aria-hidden /> : undefined };
      })}
    />
  );
}
