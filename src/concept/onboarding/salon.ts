import type { Locale } from "@/lib/locale";
import { WEEK_ORDER } from "../data/dates";
import { DEMO_VERSION, MODULE_KEYS } from "../data/generate";
import type { DemoState, PackId, Salon, Staff } from "../data/types";
import { translate } from "../i18n";
import { checkOwnSlug } from "../page/address";
import { DEFAULT_PAGE } from "../page/config";
import { slugify } from "../page/slug";
import { getPack } from "../packs";
import { weekFromHours } from "../ops/edit";
import { applyServiceAction, type ServiceDraft } from "../services/edit";

export const INDUSTRIES = ["hair", "beauty", "nails", "foot", "massage", "clinic", "other"] as const;
export type Industry = typeof INDUSTRIES[number];
const packs: Record<Industry, PackId> = {
  hair: "hair", beauty: "nails", nails: "nails", foot: "foot-massage",
  massage: "foot-massage", clinic: "clinic", other: "foot-massage",
};

export type Treatment = Pick<ServiceDraft, "name" | "duration" | "price">;
export interface SalonDraft {
  name: string;
  industry: Industry;
  language: Locale;
  currency: string;
  hours: Salon["hours"];
  treatments: Treatment[];
  people: string[];
  slug: string;
}

export function weeklyHours(saturday = false): Salon["hours"] {
  return Object.fromEntries(WEEK_ORDER.map(day => [day, day >= (saturday ? 2 : 1) && day <= (saturday ? 6 : 5)
    ? { open: saturday ? 600 : 540, close: saturday ? 1080 : 1020 } : null]));
}

const suggestions: Record<Industry, [number, number, number, number]> = {
  hair: [45, 550, 90, 1250], beauty: [60, 750, 20, 250], nails: [45, 450, 60, 550],
  foot: [50, 650, 30, 400], massage: [60, 750, 30, 450], clinic: [45, 800, 30, 550], other: [30, 400, 60, 750],
};

export function suggestedTreatments(industry: Industry, language: Locale): Treatment[] {
  const [length, price, secondLength, secondPrice] = suggestions[industry];
  return [
    { name: translate(language, `setup.${industry}1`), duration: length, price },
    { name: translate(language, `setup.${industry}2`), duration: secondLength, price: secondPrice },
  ];
}

export function salonDraft(language: Locale): SalonDraft {
  return { name: "", industry: "hair", language, currency: "SEK", hours: weeklyHours(),
    people: [""], treatments: suggestedTreatments("hair", language), slug: "" };
}

export const checkNewSlug = (value: string, demoSlug?: string) => checkOwnSlug(value, "", true, demoSlug);

export function suggestedSlug(draft: SalonDraft, demoSlug?: string) {
  const slug = slugify(draft.name);
  if (checkNewSlug(slug, demoSlug).ok) return slug;
  const fallback = slugify(translate(draft.language, "setup.defaultName"));
  return fallback === demoSlug ? `${fallback}-2` : fallback;
}

export function createSalon(today: string, draft: SalonDraft): DemoState {
  const pack = getPack(packs[draft.industry]);
  const { language, currency, hours } = draft;
  const checked = checkNewSlug(draft.slug || suggestedSlug(draft));
  if (!checked.ok) throw new Error("Invalid salon slug");
  const name = draft.name.trim() || translate(language, "setup.defaultName");
  const week = weekFromHours(hours);
  const roster = draft.people.length ? draft.people : [""];
  const staff = roster.flatMap((person, index): Staff[] => {
    if (index && !person.trim()) return [];
    const [firstName, ...rest] = (person.trim() || name).split(/\s+/);
    return [{ id: `staff-${index + 1}`, firstName, lastName: rest.join(" "), role: "", title: "", bio: "", phone: "", week }];
  });
  const state: DemoState = {
    version: DEMO_VERSION, industry: draft.industry, pack: pack.id, generatedFor: today, seq: 1,
    localization: { language, currency, bilingual: false },
    salon: { name, slug: checked.slug, hours, lunch: null, closures: [], tagline: "", address: "", area: "", email: "", phone: "", orgNumber: "" },
    staff, categories: [{ id: "menu", name: translate(language, "booking.treatments") }], services: [], retiredServices: [],
    resources: [], exceptions: [], customers: [], bookings: [], journals: [], stock: [], suppliers: [], orders: [], sales: [],
    giftCards: [], packages: [], reviews: [], inbox: [], holidays: [], campaigns: [], monthHistory: [], costs: [],
    accounting: { connected: false },
    modules: Object.fromEntries(MODULE_KEYS.map(key => [key, key !== "assistant" && (pack.modules.includes(key) || key === "finance" || key === "campaigns")])) as DemoState["modules"],
    dismissedCards: [], log: [], trash: [], supportGrants: [], tickets: [], memory: [], routines: [], domain: null,
    page: { ...DEFAULT_PAGE, sections: [{ kind: "hero", variant: "plain" }, { kind: "treatments", variant: "list" },
      { kind: "staff", variant: "names" }, { kind: "map", variant: "full" }] },
  };
  return draft.treatments.reduce((next, item) => applyServiceAction(next, { type: "service/add",
    service: { ...item, category: "menu", description: "", staffIds: staff.map(person => person.id) } }), state);
}

export function checklistProgress(state: DemoState) {
  return {
    addServices: state.services.some(service => !service.hidden),
    setHours: Object.values(state.salon.hours).some(Boolean),
    share: state.dismissedCards.includes(`shared:${state.salon.slug}`),
    first: state.bookings.some(booking => booking.status !== "cancelled"),
    connect: state.modules.assistant,
  };
}
