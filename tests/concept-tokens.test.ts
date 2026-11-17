import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import kit from "../design/brand/libovo-v0.9/tokens/colors.json" with { type: "json" };
import { contrast } from "@/concept/page/colour";

// The runtime tokens (src/concept/ui/libovo-theme.css) against the brand kit.

const runtime = readFileSync(new URL("../src/concept/ui/libovo-theme.css", import.meta.url), "utf8");

/** The light and dark value of a runtime token declared as light-dark(a, b). */
function pair(name: string): { light: string; dark: string } {
  const match = runtime.match(new RegExp(`--ui-${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, "i"));
  if (!match) throw new Error(`--ui-${name} is not a light-dark() pair`);
  return { light: match[1].toLowerCase(), dark: match[2].toLowerCase() };
}

/** Kit name → runtime token. Every colour the kit defines for both themes must be in the runtime CSS with the same values. */
const KIT_TO_RUNTIME: Record<keyof typeof kit.light, string> = {
  background: "bg",
  surface: "surface",
  "surface-secondary": "surface-2",
  "text-primary": "text",
  "text-secondary": "text-secondary",
  border: "border",
  "control-border": "input-border",
  primary: "action",
  "primary-hover": "action-hover",
  "on-primary": "action-text",
  focus: "focus",
  success: "success",
  "success-bg": "success-bg",
  warning: "warning",
  "warning-bg": "warning-bg",
  danger: "danger",
  "danger-bg": "danger-bg",
  info: "info",
  "info-bg": "info-bg",
};

/** Runtime tokens the kit does not have, each a documented deviation (docs/design/LIBOVO.md §12). */
const EXTENSIONS = ["action-bg", "staff-1", "staff-1-bg", "staff-2", "staff-2-bg", "chart-compare"];

describe("runtime tokens match the brand kit (Codex #12)", () => {
  it("has every kit colour, in light and dark, with the kit's value", () => {
    for (const [kitName, token] of Object.entries(KIT_TO_RUNTIME)) {
      expect(pair(token), `--ui-${token} (kit ${kitName})`).toEqual({
        light: kit.light[kitName as keyof typeof kit.light].toLowerCase(),
        dark: kit.dark[kitName as keyof typeof kit.dark].toLowerCase(),
      });
    }
    expect(Object.keys(KIT_TO_RUNTIME).sort()).toEqual(Object.keys(kit.light).sort());
    expect(Object.keys(kit.dark).sort()).toEqual(Object.keys(kit.light).sort());
  });

  it("keeps the brand colours", () => {
    expect(runtime).toContain(`--brand-plum: ${kit.brand.plum.toLowerCase()};`);
    expect(runtime).toContain(`--brand-apricot: ${kit.brand.apricot.toLowerCase()};`);
  });

  it("declares nothing beyond the kit except the documented extensions", () => {
    const declared = [...new Set([...runtime.matchAll(/--ui-([a-z0-9-]+):/g)].map((m) => m[1]))];
    const known = new Set([...Object.values(KIT_TO_RUNTIME), ...EXTENSIONS]);
    expect(declared.filter((name) => !known.has(name))).toEqual([]);
    for (const name of EXTENSIONS) expect(declared).toContain(name);
  });
});

describe("chart colours", () => {
  it("draw the comparison series at 3:1 or more on every studio ground, in both themes (Codex #10)", () => {
    const compare = pair("chart-compare");
    for (const scheme of ["light", "dark"] as const) {
      for (const ground of ["background", "surface", "surface-secondary"] as const) {
        expect(contrast(compare[scheme], kit[scheme][ground]), `${scheme} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("the landing sketch (#28)", () => {
  it("takes its colours from the brand tokens, with no hex values of its own", () => {
    const css = readFileSync(new URL("../src/pages/landing.module.css", import.meta.url), "utf8");
    expect(css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});
