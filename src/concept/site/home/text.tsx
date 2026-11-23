import { Fragment, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";

const NUMBER = { en: "en-GB", sv: "sv-SE" } as const;

/** A price in the page's language, from a template such as "SEK {amount}". */
export function price(template: string, locale: Locale, amount: number) {
  return template.replace("{amount}", new Intl.NumberFormat(NUMBER[locale]).format(amount));
}

/** Fills a dictionary template's {placeholders} with text or elements. */
export function fill(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/\{(\w+)\}/).map((part, i) => <Fragment key={i}>{i % 2 ? parts[part] : part}</Fragment>);
}

export const list = (value: string) => value.split("|");
