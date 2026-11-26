"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { t } from "../i18n";
import { cx } from "./cx";
import { setTheme, useThemePreference } from "./theme-control";
import { waveTheme } from "./theme-wave";

const DARK = "(prefers-color-scheme: dark)";

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(DARK);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(DARK).matches,
    () => false,
  );
}

/**
 * The sun/moon switch in the studio header: flips between light and dark as they look now ("System" counts as
 * whichever the device shows) and saves the choice. The new theme washes in from the switch (theme-wave.ts).
 * Settings keeps the full light / dark / system choice.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemePreference();
  const systemDark = useSystemDark();
  const dark = preference === "system" ? systemDark : preference === "dark";
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    waveTheme(() => flushSync(() => setTheme(dark ? "light" : "dark")), { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label={t("theme.darkSwitch")} onClick={toggle} data-help-id="shell.theme"
      className={cx("group inline-flex min-h-target shrink-0 cursor-pointer items-center justify-center rounded-full", className)}
    >
      <span className="ui-button-tint relative flex h-8 items-center rounded-full px-1 text-text-secondary group-hover:text-text">
        <span aria-hidden className={cx("absolute left-1 top-1 size-6 rounded-full bg-text transition-transform duration-slow ease-enter", dark && "translate-x-6")} />
        {([[Sun, !dark], [Moon, dark]] as const).map(([Icon, on], i) => (
          <span key={i} aria-hidden className={cx("relative flex size-6 items-center justify-center transition-colors duration-slow ease-enter", on && "text-surface")}>
            <Icon size={14} strokeWidth={2} />
          </span>
        ))}
      </span>
    </button>
  );
}
