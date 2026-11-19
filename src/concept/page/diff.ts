import { jsonEqual } from "../data/json-equal";
import type { PageConfig } from "./config";

export type PageAspect = "logo" | "colours" | "fonts" | "corners" | "photo" | "sections" | "instagram" | "css";

const same = jsonEqual;

/** What differs between two configs, in the order the editor shows it. */
export function changedAspects(before: PageConfig, after: PageConfig): PageAspect[] {
  const checks: [PageAspect, boolean][] = [
    ["logo", before.theme.logo !== after.theme.logo],
    ["colours", !same(before.theme.colors, after.theme.colors)],
    ["fonts", before.theme.fonts !== after.theme.fonts],
    ["corners", before.theme.corners !== after.theme.corners],
    ["photo", before.theme.heroPhoto !== after.theme.heroPhoto],
    ["sections", !same(before.sections, after.sections)],
    ["instagram", before.instagram !== after.instagram],
    ["css", before.css !== after.css],
  ];
  return checks.filter(([, changed]) => changed).map(([aspect]) => aspect);
}
