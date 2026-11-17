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
