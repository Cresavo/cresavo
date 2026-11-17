import type { Category, Resource, Salon, Service, Staff, StaffId, StockItem, StockUse } from "../data/types";

// What every demo business has in common: Salong Eko's address and opening
// hours, and a team of two. A pack only changes what is said about them.

const HOURS: Salon["hours"] = {
  0: null,
  1: { open: 9 * 60, close: 18 * 60 },
  2: { open: 9 * 60, close: 18 * 60 },
  3: { open: 9 * 60, close: 18 * 60 },
  4: { open: 9 * 60, close: 19 * 60 },
  5: { open: 9 * 60, close: 17 * 60 },
  6: { open: 10 * 60, close: 15 * 60 },
};

/** The same hours every open day, for the weekdays the person works. */
function weekOf(workdays: number[]): Staff["week"] {
  return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, workdays.includes(day) && HOURS[day] ? { start: HOURS[day].open, end: HOURS[day].close } : null]));
}

export function salonWith(tagline: string): Salon {
  return {
    name: "Salong Eko",
    slug: "salong-eko",
    tagline,
    address: "Dalagatan 34",
    area: "113 24 Stockholm · Vasastan",
    phone: "070-174 06 50",
    email: "hej@salongeko.example",
    orgNumber: "559900-0000",
    hours: HOURS,
    lunch: { start: 12 * 60, end: 13 * 60 },
    closures: [],
  };
}

interface Person {
  title: string;
  bio: string;
}

export function teamWith(owner: Person, employee: Person): [Staff, Staff] {
  return [
    { id: "anna", firstName: "Anna", lastName: "Ekström", role: "Owner", week: weekOf([1, 2, 3, 4, 5]), phone: "070-174 06 51", ...owner },
    { id: "erik", firstName: "Erik", lastName: "Holm", role: "Employee", week: weekOf([1, 2, 4, 5, 6]), phone: "070-174 06 52", ...employee },
  ];
}

/** The rooms of every demo business; each treatment can use either. */
export const ROOMS: Resource[] = [
  { id: "room-1", name: "Room 1", kind: "room" },
  { id: "room-2", name: "Room 2", kind: "room" },
];

/** Builds the services of one team member and category: id, name, minutes, price, short text, weeks between visits, then the products used. */
export function servicesFor(staffId: StaffId, category: Category) {
  return (id: string, name: string, duration: number, price: number, description: string, recallWeeks: number, ...consumption: StockUse[]): Service => ({
    id,
    name,
    category,
    staffIds: [staffId],
    duration,
    price,
    description,
    recallWeeks,
    consumption,
  });
}

/** A stock item; a sale price makes it a retail product. */
export function stockOf(
  id: string,
  name: string,
  category: string,
  unit: string,
  inStock: number,
  reorderAt: number,
  usagePerWeek: number,
  supplier: string,
  unitCost: number,
  salePrice?: number,
): StockItem {
  return { id, name, category, unit, inStock, reorderAt, usagePerWeek, supplier, unitCost, onOrder: 0, ...(salePrice ? { salePrice } : {}) };
}

/** An amount of a stock item used up by one visit. */
export const takes = (stockId: string, quantity: number): StockUse => ({ stockId, quantity });
