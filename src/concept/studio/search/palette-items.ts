import { phoneMatches } from "../../booking/lookup";
import { addDays, diffDays, isDateKey } from "../../data/dates";
import type { DateKey, DemoState } from "../../data/types";
import { t } from "../../i18n";
import { formatDayLong, relativeDay } from "../../i18n/format";
import { canOpen, servedBy, staffViewer, type Role } from "../../ops/access";
import { fullName } from "../../selectors";
import { HISTORY_PAGE, MORE_TAB, moreMenu, PRIMARY_NAV, SETTINGS_SECTIONS } from "../nav";

export type PaletteGroup = "customers" | "days" | "places" | "settings" | "assistant";

export interface PaletteItem {
  /** Stable across visits, so Recent can find it again. */
  id: string;
  group: PaletteGroup;
  label: string;
  meta?: string;
  /** Where it goes; the assistant item has none and opens the panel instead. */
  href?: string;
}

export const GROUP_ORDER: PaletteGroup[] = ["customers", "days", "places", "settings", "assistant"];
const CUSTOMER_LIMIT = 6;
const DAY_LIMIT = 4;
/** Days the calendar part looks through: a little back, two months ahead. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 62;

/** Lower case without accents, so "ase" finds "Åse" and "cafe" finds "Café". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** 0 when the text starts with the query, 1 when a word does, 2 anywhere, null when it does not match. */
export function matchScore(text: string, query: string): number | null {
  const haystack = fold(text);
  const needle = fold(query);
  if (!needle) return 0;
  if (haystack.startsWith(needle)) return 0;
  if (haystack.split(/[\s,.-]+/).some((word) => word.startsWith(needle))) return 1;
  return haystack.includes(needle) ? 2 : null;
}

interface Context {
  state: DemoState;
  role: Role;
  today: DateKey;
}

const pathOf = (href: string) => href.split(/[?#]/)[0];

/** Pages and settings sections the role may open, each once. */
function destinations({ state, role }: Context): PaletteItem[] {
  const menu = moreMenu(state);
  const places = [...PRIMARY_NAV, ...menu.business, ...menu.settings, MORE_TAB, { href: HISTORY_PAGE, label: "nav.log" as const }];
  const seen = new Set<string>();
  const items: PaletteItem[] = [];
  for (const item of places) {
    if (seen.has(item.href) || !canOpen(role, pathOf(item.href))) continue;
    seen.add(item.href);
    items.push({ id: `page:${item.href}`, group: "places", label: t(item.label), href: item.href });
  }
  for (const section of SETTINGS_SECTIONS) {
    if (seen.has(section.href) || !canOpen(role, pathOf(section.href))) continue;
    seen.add(section.href);
    items.push({ id: `page:${section.href}`, group: "settings", label: t(section.label), meta: section.description && t(section.description), href: section.href });
  }
  return items;
}

function visibleCustomers({ state, role }: Context) {
  if (!canOpen(role, "/studio/customers")) return [];
  const viewer = role === "staff" ? staffViewer(state) : null;
  if (!viewer) return state.customers;
  const served = servedBy(state, viewer.id);
  return state.customers.filter((customer) => served.has(customer.id));
}

function customerItem(customer: DemoState["customers"][number]): PaletteItem {
  return { id: `customer:${customer.id}`, group: "customers", label: fullName(customer), meta: customer.phone, href: `/studio/customers/${customer.id}` };
}

function dayItem(date: DateKey, today: DateKey): PaletteItem {
  const long = formatDayLong(date);
  // "Tomorrow, Thursday 3 December": the near words are searchable too.
  const label = Math.abs(diffDays(date, today)) <= 1 ? `${relativeDay(date, today)}, ${long}` : long;
  return { id: `day:${date}`, group: "days", label, meta: t("palette.inCalendar"), href: `/studio/calendar?date=${date}` };
}

function assistantItem(query: string): PaletteItem {
  const asked = query.trim();
  return { id: "assistant", group: "assistant", label: asked ? t("palette.askAbout", { query: asked }) : t("quick.ask") };
}

/**
 * What Search lists for a query, in group order. An empty query lists the pages and settings; customers and
 * days need at least a letter. "Ask the assistant" comes first when nothing is typed (so ⌘K, Enter still
 * opens it) and last otherwise, carrying what was typed.
 */
export function paletteResults(context: Context, query: string): PaletteItem[] {
  const assistant = context.state.modules.assistant ? [assistantItem(query)] : [];
  if (!query.trim()) return [...assistant, ...destinations(context)];

  const ranked = (items: PaletteItem[], text: (item: PaletteItem) => string[]) => items
    .map((item) => ({ item, score: Math.min(...text(item).map((part) => matchScore(part, query) ?? Infinity)) }))
    .filter(({ score }) => score < Infinity)
    .sort((a, b) => a.score - b.score)
    .map(({ item }) => item);

  const customers = visibleCustomers(context)
    .filter((customer) => matchScore(fullName(customer), query) !== null || phoneMatches(customer.phone, query))
    .sort((a, b) => (matchScore(fullName(a), query) ?? 3) - (matchScore(fullName(b), query) ?? 3))
    .slice(0, CUSTOMER_LIMIT)
    .map(customerItem);

  const typedDay = isDateKey(query.trim()) ? [dayItem(query.trim(), context.today)] : [];
  // A day needs a number or a word of three letters; "an" should not list every day in January.
  const dayQuery = /\d/.test(query) || fold(query).length >= 3;
  const days = canOpen(context.role, "/studio/calendar")
    ? typedDay.length ? typedDay : !dayQuery ? [] : ranked(
      // The coming days first, then the week behind.
      [...Array.from({ length: DAYS_AHEAD }, (_, i) => i), ...Array.from({ length: DAYS_BACK }, (_, i) => -1 - i)]
        .map((offset) => dayItem(addDays(context.today, offset), context.today)),
      (item) => [item.label],
    ).filter((item) => (matchScore(item.label, query) ?? 2) < 2).slice(0, DAY_LIMIT)
    : [];

  const places = ranked(destinations(context), (item) => [item.label, item.meta ?? ""]);
  return [...customers, ...days, ...places, ...assistant];
}

/** Finds an item saved in Recent again, if it is still there and still allowed. */
export function resolveRecent(context: Context, id: string): PaletteItem | undefined {
  if (id.startsWith("day:")) {
    const date = id.slice(4);
    return isDateKey(date) && canOpen(context.role, "/studio/calendar") ? dayItem(date, context.today) : undefined;
  }
  if (id.startsWith("customer:")) {
    const customer = visibleCustomers(context).find((c) => c.id === id.slice(9));
    return customer && customerItem(customer);
  }
  return destinations(context).find((item) => item.id === id);
}
