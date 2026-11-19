import { isEmail } from "../connections/core";
import { isContactPhone } from "../booking/lookup";
import type { DemoState, Salon } from "../data/types";

// The salon's own details as the owner edits them under Settings → Salon. The stored
// field names stay the same (they are part of the saved state and the booking page).

export const SALON_DETAIL_FIELDS = ["name", "phone", "email", "address", "area"] as const;
export type SalonDetailField = (typeof SALON_DETAIL_FIELDS)[number];
export type SalonDetails = Pick<Salon, SalonDetailField>;

export type SalonDetailProblem = "required" | "short" | "long" | "phone" | "email";

const MAX_LENGTH: Record<SalonDetailField, number> = { name: 60, phone: 30, email: 254, address: 100, area: 60 };
const MIN_NAME = 2;

export type SalonDetailsCheck =
  | { ok: true; details: SalonDetails }
  | { ok: false; problems: Partial<Record<SalonDetailField, SalonDetailProblem>> };

/** Trims every field and says what is wrong with each. Only the name is required; phone and email may be left empty. */
export function checkSalonDetails(input: Partial<Record<SalonDetailField, unknown>>): SalonDetailsCheck {
  const details = Object.fromEntries(SALON_DETAIL_FIELDS.map((field) => {
    const value = input[field];
    return [field, typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""];
  })) as SalonDetails;
  const problems: Partial<Record<SalonDetailField, SalonDetailProblem>> = {};
  for (const field of SALON_DETAIL_FIELDS) {
    if (details[field].length > MAX_LENGTH[field]) problems[field] = "long";
  }
  if (!details.name) problems.name = "required";
  else if (details.name.length < MIN_NAME) problems.name = "short";
  if (details.phone && !problems.phone && !isContactPhone(details.phone)) problems.phone = "phone";
  if (details.email && !problems.email && !isEmail(details.email)) problems.email = "email";
  return Object.keys(problems).length ? { ok: false, problems } : { ok: true, details };
}

/** The fields whose value differs between two versions of the salon. */
export function changedDetails(before: Salon, after: Salon): SalonDetailField[] {
  return SALON_DETAIL_FIELDS.filter((field) => before[field] !== after[field]);
}

/** Fields left out keep their current value. Invalid or unchanged details leave the state as it is. */
export function applySalonDetails(state: DemoState, input: Partial<Record<SalonDetailField, unknown>>): DemoState {
  const current = Object.fromEntries(SALON_DETAIL_FIELDS.map((field) => [field, state.salon[field]]));
  const given = Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value !== undefined));
  const check = checkSalonDetails({ ...current, ...given });
  if (!check.ok) return state;
  const salon = { ...state.salon, ...check.details };
  return changedDetails(state.salon, salon).length ? { ...state, salon } : state;
}
