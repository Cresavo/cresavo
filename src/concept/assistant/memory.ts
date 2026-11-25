import type { Customer, DateKey, DemoState, StaffId } from "../data/types";
import { matchNames, normalize } from "../intent/match";
import { fullName } from "../selectors";

// What the assistant remembers about the business, as short plain-text
// notes the owner can read, edit and forget. Health and journal text and
// contact details never go in: `memoryRejection` is checked when a note is
// saved, edited and before any note is sent to an AI model.

export type MemoryKind = "fact" | "preference" | "thread";

export interface MemoryItem {
  id: string;
  text: string;
  kind: MemoryKind;
  /** Who the note is about, when that is known. */
  customerId?: string;
  staffId?: StaffId;
  savedOn: DateKey;
  /** "owner": the owner said "remember…". "assistant": the assistant noticed it and the owner said yes. */
  source: "owner" | "assistant";
}

export type NewMemory = Omit<MemoryItem, "id">;

export type MemoryRejection = "empty" | "health" | "contact" | "journal";

const MAX_LENGTH = 200;
const MIN_JOURNAL_OVERLAP = 12;

const HEALTH =
  /\b(allerg\w*|diabet\w*|pain\w*|ache\w*|fung\w*|wart\w*|verruca\w*|wound\w*|infect\w*|inflam\w*|diagnos\w*|medic\w*|prescri\w*|pregnan\w*|blood|psoria\w*|eczema|cancer|surger\w*|operation|injur\w*|illness|ill|sick\w*|symptom\w*|skin|ingrown|callus\w*|corns?|swollen|swelling|rash|bleed\w*|condition|therapy|depress\w*|anxiety|disease|health)\b/;
const SWEDISH_HEALTH = /\b(smart\w*|vark\w*|blod\w*|gravid\w*|svull\w*|svamp\w*|sjuk\w*|skad\w*|hud\w*|eksem\w*|lakemedel\w*|sar\w*|nageltrang\w*|forhardnad\w*|angest\w*)\b/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(?:\+|\b0)\d[\d\s.()-]{5,}\d\b|\b\d{7,}\b/;
/** A grouped number such as (212) 555-1234, without a leading 0 or +. ISO dates are left alone. */
const FORMATTED_PHONE = /(?<!\d)(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?(?!\d)/;
const ADDRESS = /\b(address|lives (at|on|in)|street|road|gatan|vägen|postcode|zip|adress|postnummer|bor (?:på|i|vid))\b|[a-zåäö]+(?:gatan|vägen)\s+\d+/;

/** Why a note must not be stored, or null when it may. Journal text is matched against the business's journal entries. */
export function memoryRejection(text: string, state?: Pick<DemoState, "journals">): MemoryRejection | null {
  const plain = text.trim();
  if (!plain || plain.length > MAX_LENGTH) return "empty";
  return sensitiveKind(plain, state);
}

/** Whether text holds a phone number, e-mail address or postal address. */
export function contactKind(text: string): "contact" | null {
  const plain = text.trim();
  if (EMAIL.test(plain) || PHONE.test(plain) || ADDRESS.test(plain.toLowerCase())) return "contact";
  const formatted = plain.match(FORMATTED_PHONE);
  if (formatted && !/^\d{4}-\d{2}-\d{2}$/.test(formatted[0].trim()) && formatted[0].replace(/\D/g, "").length >= 7) return "contact";
  return null;
}

/** Whether text holds health or journal details or contact details, of any length. Speech and the memory both check it. */
export function sensitiveKind(text: string, state?: Pick<DemoState, "journals">): Exclude<MemoryRejection, "empty"> | null {
  const plain = text.trim();
  if (contactKind(plain)) return "contact";
  const words = normalize(plain);
  if (HEALTH.test(words) || SWEDISH_HEALTH.test(words)) return "health";
  const journalText = (state?.journals ?? []).flatMap((j) => [j.treatment, j.observations, j.advice, j.nextVisit ?? ""]).map(normalize);
  const overlaps = (a: string, b: string) => a.length >= MIN_JOURNAL_OVERLAP && b.includes(a);
  if (journalText.some((entry) => overlaps(entry, words) || overlaps(words, entry))) return "journal";
  return null;
}

/** Only notes that pass the filter, e.g. before they are sent to a model. */
export function safeMemory(items: MemoryItem[], state?: Pick<DemoState, "journals">): MemoryItem[] {
  return items.filter((item) => memoryRejection(item.text, state) === null);
}

/** "Remember Lena prefers Erik" → "Lena prefers Erik". Null when the owner did not ask to remember something. */
export function rememberRequest(input: string): string | null {
  const match = input.trim().match(/^(?:please\s+)?(?:remember|note|keep in mind)(?:\s+that)?[:,]?\s+(.+?)[.!]*$/i);
  return match ? match[1] : null;
}

/** A statement worth remembering that the owner did not ask to save: "Lena always wants mornings". */
export function noticedFact(input: string): string | null {
  const text = input.trim().replace(/[.!]+$/, "");
  if (!text || /\?$/.test(text) || /^(what|who|when|how|which|why|can|could|show|book|move|cancel|send|order|remember|forget)\b/i.test(text)) return null;
  return /\b(prefers?|always|never|only (comes|wants|books|works)|likes|doesn'?t like|does not like)\b/i.test(text) ? capitalise(text) : null;
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);

export interface MemorySubject {
  customers: Customer[];
  staffId?: StaffId;
  /** True when the note says a customer prefers a staff member. */
  preference: boolean;
}

/** Who a note is about. Several customers with the same first name are all returned so the caller can ask. */
export function memorySubject(state: DemoState, text: string): MemorySubject {
  const preference = text.match(/^(.+?)\s+(?:prefers|wants|likes|always books with|only books with|föredrar|vill gå till|bokar alltid hos)\s+(.+)$/i);
  const subjectText = preference?.[1] ?? text;
  const staff = matchNames(preference?.[2] ?? text, state.staff.map((s) => ({ id: s.id, name: s.firstName })));
  const staffId = staff.length === 1 ? staff[0].id : undefined;
  const subjectIsStaff = matchNames(subjectText, state.staff.map((s) => ({ id: s.id, name: s.firstName }))).length > 0;
  const customers = subjectIsStaff ? [] : matchNames(subjectText, state.customers.map((c) => ({ id: c.id, name: fullName(c) })));
  const byId = new Map(state.customers.map((c) => [c.id, c]));
  const servesWith = (c: Customer) => !!staffId && state.services.some((s) => s.staffIds.includes(staffId) && (c.category === "both" || s.category === c.category));
  return {
    customers: customers.map((c) => byId.get(c.id)!).sort((a, b) => Number(servesWith(b)) - Number(servesWith(a)) || Number(b.isRegular) - Number(a.isRegular)),
    staffId,
    preference: !!preference && !!staffId && !subjectIsStaff,
  };
}

/** The note as it will be saved: one customer written out in full, so it stays clear later. */
export function memoryFor(state: DemoState, text: string, customer: Customer | undefined, today: DateKey, source: MemoryItem["source"]): NewMemory {
  const subject = memorySubject(state, text);
  const firstName = customer?.firstName;
  const written = customer && firstName && !normalize(text).includes(normalize(fullName(customer)))
    ? text.replace(new RegExp(`\\b${firstName}\\b`, "i"), fullName(customer))
    : text;
  return {
    text: capitalise(written),
    kind: subject.preference && customer ? "preference" : "fact",
    customerId: customer?.id,
    staffId: subject.staffId,
    savedOn: today,
    source,
  };
}

/** The staff member a customer is booked with first: what the owner told the assistant, else the customer's usual one. */
export function preferredStaffOf(state: DemoState, customer: Customer): StaffId {
  return rememberedPreference(state, customer.id)?.staffId ?? customer.preferredStaff;
}

/** The newest remembered preference for a customer. */
export function rememberedPreference(state: DemoState, customerId: string): MemoryItem | undefined {
  return state.memory.find((item) => item.kind === "preference" && item.customerId === customerId && item.staffId);
}

/** Notes whose words all appear, newest first. An empty query lists everything. */
export function searchMemory(items: MemoryItem[], query: string): MemoryItem[] {
  const words = normalize(query).split(" ").filter(Boolean);
  return items.filter((item) => {
    const text = normalize(item.text);
    return words.every((word) => text.includes(word));
  });
}

/** True when a note with the same words is already saved. */
export function alreadyRemembered(items: MemoryItem[], text: string): boolean {
  const wanted = normalize(text);
  return items.some((item) => normalize(item.text) === wanted);
}
