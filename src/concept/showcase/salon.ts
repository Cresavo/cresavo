import type { Salon, Service } from "../data/types";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { DEFAULT_PACK, getPack } from "../packs";

// The showcase sites are two website designs for the demo salon. Its booking
// engine, services, prices and hours are the demo's own (packs/foot-massage.ts),
// so what a visitor books on a showcase is exactly what the demo salon sells.

const pack = getPack(DEFAULT_PACK);

export const SHOWCASE_SLUG = pack.salon.slug;
export const SALON: Salon = pack.salon;
export const TEAM = pack.staff;

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
}

export interface MenuGroup {
  category: string;
  items: MenuItem[];
}

/** The services customers may book, in Swedish, grouped by category in the salon's own order. */
export function menuOf(services: readonly Service[]): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const service of services) {
    if (service.hidden) continue;
    const { id, name, description, duration, price } = serviceCopy(service, "sv");
    groups.set(service.category, [...(groups.get(service.category) ?? []), { id, name, description, duration, price }]);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}

/** The menu as the demo starts out, for the first paint before the visitor's own demo state is read. */
export const PACK_MENU = menuOf(pack.services);

const number = new Intl.NumberFormat("sv-SE");
export const kronor = (amount: number) => `${number.format(amount)} kr`;
export const minutes = (duration: number) => `${duration} min`;

const DAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const hour = (minutes: number) => `${Math.floor(minutes / 60)}${minutes % 60 ? `.${String(minutes % 60).padStart(2, "0")}` : ""}`;

export interface HoursLine {
  days: string;
  hours: string | null;
}

/** Opening hours from Monday to Sunday, with neighbouring days that keep the same hours run together ("måndag–onsdag"). */
export function openingHours(hours: Salon["hours"] = SALON.hours): HoursLine[] {
  const week = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, open: hours[day] ? `${hour(hours[day].open)}–${hour(hours[day].close)}` : null }));
  const lines: { first: number; last: number; open: string | null }[] = [];
  for (const { day, open } of week) {
    const previous = lines.at(-1);
    if (previous && previous.open === open) previous.last = day;
    else lines.push({ first: day, last: day, open });
  }
  const name = (day: number) => DAYS[day];
  return lines.map(({ first, last, open }) => ({
    days: first === last ? capitalise(name(first)) : `${capitalise(name(first))}–${name(last)}`,
    hours: open,
  }));
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const lunchLine = () => (SALON.lunch ? `${hour(SALON.lunch.start)}–${hour(SALON.lunch.end)}` : null);

/** The phone number as a tel: link. */
export const telHref = (phone: string = SALON.phone) => `tel:${phone.replace(/[^\d+]/g, "").replace(/^0/, "+46")}`;
