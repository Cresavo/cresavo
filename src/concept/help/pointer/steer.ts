import type { HelpEntry } from "../map/types";
import { ANOTHER_DAY, type AnchorLookup } from "./dom";

// When the guide reaches a page whose list has nothing to point at, it explains why and points somewhere useful
// instead of saying the place is missing: another day for bookings, Import for customers, Add treatment.

export interface Steer {
  /** "unmatched": no visit of the kind the action needs; "empty": the list has nothing at all. */
  kind: "unmatched" | "empty";
  /** Entries to point at instead, the first one on screen. */
  pointAt: readonly string[];
}

/**
 * What to do when a step's element is not there. `onPage` is whether the step's page is the one showing, and
 * `settled` whether that page has had time to draw (or something to point at is already on it): a list that is
 * still loading is not empty.
 */
export function steerFor(step: HelpEntry, entry: HelpEntry, result: AnchorLookup, { onPage, settled }: { onPage: boolean; settled: boolean }): Steer | null {
  if (result === "unmatched" && entry.prefer) return { kind: "unmatched", pointAt: [ANOTHER_DAY[entry.prefer]] };
  if (result !== "absent" || !step.empty || !onPage || !settled) return null;
  return entry.prefer ? { kind: "unmatched", pointAt: [ANOTHER_DAY[entry.prefer]] } : { kind: "empty", pointAt: step.empty.pointAt };
}
