"use client";

import { Fragment, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";
import { setLocale } from ".";
import { setCurrency } from "./format";

let active: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function activate(language: Locale, currency: string, key: string) {
  setLocale(language);
  setCurrency(currency);
  active = key;
}

/**
 * Activate presentation settings before mounting any of the dictionary consumers.
 * `immediate` is for a salon the server already has: the settings are applied
 * while rendering, so the first response and hydration both show the salon. The
 * dictionary is process-wide, so this is only for a render that reads it
 * synchronously, right below this component.
 */
export function ConceptLanguage({ language, currency, immediate = false, children }: {
  language: Locale;
  currency: string;
  immediate?: boolean;
  children: ReactNode;
}) {
  const key = `${language}:${currency}`;
  if (immediate && active !== key) activate(language, currency, key);
  const current = useSyncExternalStore(subscribe, () => active, () => immediate ? key : null);
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    if (active === key) return;
    activate(language, currency, key);
    listeners.forEach((listener) => listener());
  }, [language, currency, key]);
  return current === key ? <Fragment key={key}>{children}</Fragment> : null;
}
