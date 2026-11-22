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

/** Activate presentation settings before mounting any of the dictionary consumers. */
export function ConceptLanguage({ language, currency, children }: {
  language: Locale;
  currency: string;
  children: ReactNode;
}) {
  const current = useSyncExternalStore(subscribe, () => active, () => null);
  const key = `${language}:${currency}`;
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    if (active === key) return;
    setLocale(language);
    setCurrency(currency);
    active = key;
    listeners.forEach((listener) => listener());
  }, [language, currency, key]);
  return current === key ? <Fragment key={key}>{children}</Fragment> : null;
}
