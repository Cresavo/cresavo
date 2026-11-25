import { jsonEqual } from "./json-equal";
import { returnRedemptions } from "../giftcards/cards";
import { DEFAULT_POLICY, hasSettlement, type CancellationPolicy } from "../booking/protection";
import { defaultBusinessLocalization } from "../i18n/business";
import { DEFAULT_REMINDER_SETTINGS } from "../booking/reminders";
import { EMPTY_ABOUT, normalizeAbout, type PageAbout } from "../page/about";
import { DEFAULT_PAGE, type PageConfig } from "../page/config";
import { addSectionAfter, DEFAULT_SECTIONS, type PageSection } from "../page/sections";
import { applyTemplate } from "../page/templates";
import { PALETTES } from "../page/theme";
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

// The page as v14 introduced it: later fields are added by the step of their own version.
const V14_PAGE = { theme: DEFAULT_PAGE.theme, sections: DEFAULT_PAGE.sections, instagram: DEFAULT_PAGE.instagram, css: DEFAULT_PAGE.css };

type PageSnapshot = Partial<PageConfig> | undefined;
type SavedEntry = { patch?: { values?: { page?: { before: PageSnapshot; after: PageSnapshot } } } };

/** A page from before v24 with its About text. A page that already has one is returned as it is. */
const withAbout = <T extends PageSnapshot>(page: T, about: PageAbout): T => (page && !page.about ? { ...page, about } : page);

/**
 * The page snapshots that undo keeps in the activity log, lifted like the page
 * itself: undo compares the whole page with the snapshot, so a snapshot without
 * the new field would make every earlier page edit look changed since.
 */
function logWithAbout(log: unknown, about: PageAbout): unknown {
  if (!Array.isArray(log)) return log;
  return (log as SavedEntry[]).map((entry) => {
    const page = entry?.patch?.values?.page;
    if (!page) return entry;
    return { ...entry, patch: { ...entry.patch, values: { ...entry.patch!.values, page: { before: withAbout(page.before, about), after: withAbout(page.after, about) } } } };
  });
}

/** The About text a page starts with: the demo business's own words, nothing for an own salon. */
const packAbout = (saved: Saved): PageAbout => ({ ...EMPTY_ABOUT, text: saved.industry ? "" : getPack(saved.pack as PackId).about ?? "" });

/** v24's change: the About text on the page and on the page snapshots in the activity log. A page that has one keeps it. */
function backfillAbout(saved: Saved): Saved {
  const about = packAbout(saved);
  return { ...saved, page: withAbout(saved.page as PageConfig, about), log: logWithAbout(saved.log, about) };
}

/** A page or page snapshot from before v25 with the section style it was drawn in. */
const withStyle = <T extends PageSnapshot>(page: T): T =>
  (page?.theme && !page.theme.style ? { ...page, theme: { ...page.theme, style: DEFAULT_PAGE.theme.style } } : page);

/** The page snapshots that earlier page edits keep in the activity log, given the same style, so their Undo still compares equal. */
function logWithStyle(log: unknown): unknown {
  if (!Array.isArray(log)) return log;
  return (log as SavedEntry[]).map((entry) => {
    const page = entry?.patch?.values?.page;
    if (!page) return entry;
    return { ...entry, patch: { ...entry.patch, values: { ...entry.patch!.values, page: { before: withStyle(page.before), after: withStyle(page.after) } } } };
  });
}

/**
 * True for the demo salon's page exactly as v24 generated or migrated it: the default look in forest
 * colours and the pack's own About text, with or without the About section, and no page edit in the
 * activity log. An edit makes the page the owner's, and repainting it would also break that edit's Undo.
 */
function isUntouchedEkoPage(saved: Saved, page: PageConfig, log: unknown): boolean {
  if (saved.industry) return false;
  const sections = [DEFAULT_SECTIONS, addSectionAfter(DEFAULT_SECTIONS, "about", "staff")];
  const edited = Array.isArray(log) && (log as SavedEntry[]).some((entry) => entry?.patch?.values?.page);
  return !edited
    && jsonEqual(page.theme, { ...DEFAULT_PAGE.theme, colors: PALETTES.forest })
    && sections.some((generated) => jsonEqual(page.sections, generated))
    && page.instagram === DEFAULT_PAGE.instagram && page.css === DEFAULT_PAGE.css
    && jsonEqual(page.about, packAbout(saved));
}

type PolicySnapshot = Partial<CancellationPolicy> | undefined;
type PolicyEntry = { patch?: { values?: { cancellationPolicy?: { before: PolicySnapshot; after: PolicySnapshot } } } };

/**
 * A policy from before v26 with the payment choice it stood for. Under the old rules a treatment with a
 * deposit took that deposit when booked and every other treatment was paid at the salon.
 */
function withPayment<T extends PolicySnapshot>(policy: T, payAtSalonDefault: boolean): T {
  if (!policy) return policy;
  const entries = Object.entries(policy.deposits ?? {});
  // A deposit of zero was an explicit "pay at the salon" choice and must survive a later default change.
  const deposits = Object.fromEntries(entries.filter(([, amount]) => amount > 0));
  const payAtSalon = Object.fromEntries(entries.map(([id, amount]) => [id, amount <= 0]));
  return { ...policy, payAtSalonDefault, payAtSalon, deposits };
}

/**
 * True for the demo salon's booking rules exactly as they were generated: no deposit, the default
 * hours and fees, and no rules edit in the activity log. Before v26 that meant paying at the salon;
 * such a demo takes the new default of paying when booking. Rules the owner set stay as they meant.
 */
function isUntouchedEkoPolicy(saved: Saved): boolean {
  if (saved.industry) return false;
  const policy = saved.cancellationPolicy as CancellationPolicy | undefined;
  const edited = Array.isArray(saved.log) && (saved.log as PolicyEntry[]).some((entry) => entry?.patch?.values?.cancellationPolicy);
  const rules = (p: Partial<CancellationPolicy>) => ({ freeHours: p.freeHours, latePercent: p.latePercent, noShowPercent: p.noShowPercent, deposits: p.deposits, newCustomersOnly: p.newCustomersOnly, exemptServices: p.exemptServices });
  return !edited && !!policy && jsonEqual(rules(policy), rules(DEFAULT_POLICY));
}

/** v26's change: whether treatments are paid when booked or at the salon, on the rules and on the rules snapshots undo keeps, so their Undo still compares equal. */
function backfillPayment(saved: Saved): Saved {
  const payAtSalonDefault = !isUntouchedEkoPolicy(saved);
  const log = Array.isArray(saved.log) ? (saved.log as PolicyEntry[]).map((entry) => {
    const policy = entry?.patch?.values?.cancellationPolicy;
    if (!policy) return entry;
    const values = { ...entry.patch!.values, cancellationPolicy: { before: withPayment(policy.before, payAtSalonDefault), after: withPayment(policy.after, payAtSalonDefault) } };
    return { ...entry, patch: { ...entry.patch, values } };
  }) : saved.log;
  return { ...saved, cancellationPolicy: withPayment((saved.cancellationPolicy ?? DEFAULT_POLICY) as CancellationPolicy, payAtSalonDefault), log };
}

const STEPS: Record<number, (saved: Saved) => Saved> = {
  // v13 added the assistant's memory and routines.
  12: (saved) => ({ ...saved, memory: [], routines: [], version: 13 }),
  // v14 added the booking page design and the own-domain connection.
  13: (saved) => ({ ...saved, page: V14_PAGE, domain: null, version: 14 }),
  // v15 (the brand v0.9 rebrand) changed no shape. A saved page keeps its colours as the
  // owner left them; only freshly generated Salong Eko data starts on Forest.
  14: (saved) => ({ ...saved, version: 15 }),
  // v16 made the price list editable: its headings became data (they were fixed per industry pack) and
  // deleted treatments that bookings still name are kept aside.
  // A booking page still on the old default sections gets the new default (team and reviews
  // after the price list, gift cards folded at the end); one the owner arranged is left alone.
  15: (saved) => {
    const page = saved.page as PageConfig;
    const untouched = jsonEqual(page.sections, V15_SECTIONS);
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
  17: (saved) => ({ ...saved, localization: defaultBusinessLocalization(saved.pack as PackId), version: 18 }),
  18: (saved) => ({ ...saved, industry: null, version: 19 }),
  // The demo salon became English by default, with Swedish offered to visitors. Own salons keep their choice.
  19: (saved) => (saved.industry ? { ...saved, version: 20 } : { ...saved, localization: defaultBusinessLocalization(saved.pack as PackId), version: 20 }),
  20: (saved) => ({ ...saved, reminderSettings: { ...DEFAULT_REMINDER_SETTINGS }, version: 21 }),
  21: (saved) => {
    const state = saved as unknown as DemoState;
    const visits = [...state.bookings, ...state.trash.flatMap(entry => entry.kind === "customer" ? entry.bookings : [])];
    const settled = new Set(visits.filter(hasSettlement).map(booking => booking.id));
    return {
      ...saved, version: 22,
      cancellationPolicy: state.cancellationPolicy ?? DEFAULT_POLICY,
      checkoutHolds: state.checkoutHolds ?? [],
      giftCards: returnRedemptions(state.giftCards, settled),
    };
  },
  // v23 can mark bookings and customers as examples (new salons start with a few) and starts new
  // salons with every module off. Existing salons keep their modules. Deposit-branch saves could
  // reach v22 before reminder settings existed, so they get the defaults here.
  22: (saved) => ({ ...saved, reminderSettings: saved.reminderSettings ?? { ...DEFAULT_REMINDER_SETTINGS }, version: 23 }),
  // v24 added the booking page's About text. The section stays off on every saved page; the demo
  // business gets its text ready for when the section is added, an own salon starts empty.
  23: (saved) => ({ ...backfillAbout(saved), version: 24 }),
  // v25 added the section style and the ready-made designs. Every page and every page snapshot in the
  // activity log gets the style it was drawn in. The demo salon gets the Eko design while its page
  // still wears the look it was generated with; a page the owner has changed is theirs and stays.
  // A v24 save written by the designs' own preview builds has the style but no About text, so that is filled in first.
  24: (saved) => {
    const filled = backfillAbout(saved);
    const page = withStyle(filled.page as PageConfig);
    const log = logWithStyle(filled.log);
    return { ...filled, page: isUntouchedEkoPage(filled, page, log) ? applyTemplate(page, "eko") : page, log, version: 25 };
  },
  // v26 made paying the full price when booking online the default, with "pay at the salon" as the
  // owner's choice. Before, no deposit meant paying at the salon, and every saved own salon and every
  // rules edit keeps that meaning (treatments with a deposit keep it). Only the demo salon still on its
  // generated rules takes the new default.
  25: (saved) => ({ ...backfillPayment(saved), version: 26 }),
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
  if (current.version !== DEMO_VERSION) return null;
  // A save at the current version can still lack the About object (written by hand or cut short):
  // the studio reads it on every screen, so it is filled in here and the rest of the salon is kept.
  const page = current.page as PageSnapshot;
  const whole = typeof page?.about?.heading === "string" && typeof page.about.text === "string";
  return (page && !whole ? { ...current, page: { ...page, about: normalizeAbout(page.about) } } : current) as unknown as DemoState;
}
