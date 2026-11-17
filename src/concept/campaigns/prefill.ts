import { addDays, diffDays, fromKey, toKey } from "../data/dates";
import type { DateKey, DemoState, Holiday } from "../data/types";
import { packOf } from "../packs";
import { t, words } from "../i18n";
import { normalize } from "../intent/match";

/** What the campaign studio starts with. Everything can be changed in the first step. */
export interface CampaignPrefill {
  name: string;
  serviceIds: string[];
  discountPercent: number;
  from: DateKey;
  to: DateKey;
  holidayId?: string;
}

const DEFAULT_DISCOUNT = 15;
const DEFAULT_RUN_DAYS = 14;
const MAX_DISCOUNT = 90;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A holiday campaign starts `leadDays` before the day, or today when that has already passed. */
export function prefillForHoliday(state: DemoState, holiday: Holiday, today: DateKey): CampaignPrefill {
  const mentioned = Number(holiday.idea.match(/(\d+)%/)?.[1]);
  return {
    name: t("campaigns.holidayName", { name: holiday.name }),
    serviceIds: holiday.serviceIds.filter((id) => state.services.some((s) => s.id === id)),
    discountPercent: mentioned > 0 && mentioned <= MAX_DISCOUNT ? mentioned : DEFAULT_DISCOUNT,
    from: diffDays(holiday.date, today) > holiday.leadDays ? addDays(holiday.date, -holiday.leadDays) : today,
    to: holiday.date,
    holidayId: holiday.id,
  };
}

function monthRange(monthIndex: number, today: DateKey): { from: DateKey; to: DateKey } {
  const now = fromKey(today);
  const year = monthIndex < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
  const first = toKey(new Date(year, monthIndex, 1, 12));
  return { from: first > today ? first : today, to: toKey(new Date(year, monthIndex + 1, 0, 12)) };
}

function periodIn(text: string, today: DateKey): { from: DateKey; to: DateKey } {
  const month = words.months.findIndex((name) => new RegExp(`\\b${name.toLowerCase()}\\b`).test(text));
  if (month >= 0) return monthRange(month, today);
  if (/\bthis month\b/.test(text)) return monthRange(fromKey(today).getMonth(), today);
  if (/\bthis week\b/.test(text)) return { from: today, to: addDays(today, (7 - fromKey(today).getDay()) % 7) };
  return { from: today, to: addDays(today, DEFAULT_RUN_DAYS - 1) };
}

/** Treatments the text asks for: a treatment by name, or everything in a category such as "massage" or "foot care". */
function servicesIn(text: string, state: DemoState): { ids: string[]; label: string } | null {
  const named = state.services.filter((s) => text.includes(normalize(s.name)));
  if (named.length) return { ids: named.map((s) => s.id), label: named.length === 1 ? named[0].name : t("campaigns.name.several") };
  const category = packOf(state).categories.find((id) => text.includes(normalize(t(`category.${id}`))));
  if (!category) return null;
  return { ids: state.services.filter((s) => s.category === category).map((s) => s.id), label: t(`category.${category}`) };
}

/**
 * Reads "make a Father's Day campaign" or "20% off massage all of March" into a
 * starting point for the studio. Null when the text names neither a holiday
 * nor a discount on a treatment.
 */
export function parseCampaignRequest(input: string, state: DemoState, today: DateKey): CampaignPrefill | null {
  const text = normalize(input);
  if (!/\b(campaign|offer|poster|off|discount|promote|promotion)\b/.test(text)) return null;
  const upcoming = state.holidays.filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const named = upcoming.find(h => text.includes(normalize(h.name)));
  const holiday = named ?? (/\b(next|upcoming|holiday|seasonal)\b/.test(text) ? upcoming[0] : undefined);
  if (holiday) return prefillForHoliday(state, holiday, today);
  const percent = Number(input.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i)?.[1]);
  const services = servicesIn(text, state);
  if (!services || !(percent > 0 && percent <= MAX_DISCOUNT)) return null;
  return {
    name: t("campaigns.name.discount", { percent, service: services.label }),
    serviceIds: services.ids,
    discountPercent: Math.round(percent),
    ...periodIn(text, today),
  };
}

/** The studio address for a prefill, e.g. "/studio/more/campaigns/new?holiday=...". */
export function studioHref(prefill: CampaignPrefill, holidayOnly = false): string {
  const base = "/studio/more/campaigns/new";
  if (holidayOnly && prefill.holidayId) return `${base}?holiday=${encodeURIComponent(prefill.holidayId)}`;
  const params = new URLSearchParams({
    name: prefill.name,
    services: prefill.serviceIds.join(","),
    percent: String(prefill.discountPercent),
    from: prefill.from,
    to: prefill.to,
  });
  return `${base}?${params}`;
}

/** Reads the studio address back; unknown or invalid values give null. */
export function prefillFromQuery(params: URLSearchParams, state: DemoState, today: DateKey): CampaignPrefill | null {
  const holiday = state.holidays.find((h) => h.id === params.get("holiday"));
  if (holiday && !params.has("services")) return prefillForHoliday(state, holiday, today);
  const serviceIds = (params.get("services") ?? "").split(",").filter((id) => state.services.some((s) => s.id === id));
  const percent = Number(params.get("percent"));
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const name = params.get("name")?.trim();
  if (!name || !serviceIds.length || !(percent >= 0 && percent <= MAX_DISCOUNT) || !DATE.test(from) || !DATE.test(to) || to < from) return null;
  return { name, serviceIds, discountPercent: Math.round(percent), from, to, holidayId: holiday?.id };
}
