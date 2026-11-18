import { DEFAULT_PAGE, type PageConfig } from "../page/config";
import { DEFAULT_SECTIONS, type PageSection } from "../page/sections";
import { getPack } from "../packs";
import { startCategories } from "../services/categories";
import { DEMO_VERSION } from "./generate";
import type { DemoState, PackId } from "./types";

// Saved demo states from older versions are brought up to date in place, so a
// version bump does not throw away the owner's bookings, edits and page
// design. Each step lifts one version to the next and only adds what that
// version introduced; anything older than the oldest step starts fresh.

type Saved = Record<string, unknown> & { version: number };

const V15_SECTIONS: PageSection[] = [
  { kind: "hero", variant: "photo" },
  { kind: "treatments", variant: "list" },
  { kind: "giftcards", variant: "check" },
  { kind: "reviews", variant: "cards" },
  { kind: "map", variant: "full" },
];

const STEPS: Record<number, (saved: Saved) => Saved> = {
  // v13 added the assistant's memory and routines.
  12: (saved) => ({ ...saved, memory: [], routines: [], version: 13 }),
  // v14 added the booking page design and the own-domain connection.
  13: (saved) => ({ ...saved, page: DEFAULT_PAGE, domain: null, version: 14 }),
  // v15 (the brand v0.9 rebrand) changed no shape. A saved page keeps its colours as the
  // owner left them; only freshly generated Salong Eko data starts on Forest.
  14: (saved) => ({ ...saved, version: 15 }),
  // v16 made the price list editable: its headings became data (they were fixed per industry pack) and
  // deleted treatments that bookings still name are kept aside.
  // A booking page still on the old default sections gets the new default (team and reviews
  // after the price list, gift cards folded at the end); one the owner arranged is left alone.
  15: (saved) => {
    const page = saved.page as PageConfig;
    const untouched = JSON.stringify(page.sections) === JSON.stringify(V15_SECTIONS);
    return { ...saved, page: untouched ? { ...page, sections: DEFAULT_SECTIONS } : page, categories: startCategories(getPack(saved.pack as PackId)), retiredServices: [], version: 16 };
  },
  // v17 adds portraits to the existing roster, including solo businesses.
  16: (saved) => {
    const team = getPack(saved.pack as PackId).staff;
    const staff = (saved.staff as DemoState["staff"]).map((person) => ({
      ...person,
      photo: person.photo ?? team.find((member) => member.id === person.id)?.photo,
    }));
    return { ...saved, staff, version: 17 };
  },
};

/** The oldest saved version that can still be migrated. */
export const OLDEST_MIGRATABLE = Math.min(...Object.keys(STEPS).map(Number));

/** A saved state at the current version, or null when it is unknown, too old or not a state at all. */
export function migrateState(saved: unknown): DemoState | null {
  if (!saved || typeof saved !== "object" || typeof (saved as Saved).version !== "number") return null;
  let current = saved as Saved;
  while (current.version < DEMO_VERSION) {
    const step = STEPS[current.version];
    if (!step) return null;
    current = step(current);
  }
  return current.version === DEMO_VERSION ? (current as unknown as DemoState) : null;
}
