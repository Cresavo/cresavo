import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import kit from "../design/brand/cresavo-v0.1/tokens/colors.json" with { type: "json" };
import { contrast } from "@/concept/page/colour";

// The runtime tokens (src/concept/ui/brand-theme.css) against the brand kit.

const runtime = readFileSync(new URL("../src/concept/ui/brand-theme.css", import.meta.url), "utf8");

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

/** The kit's six studio extensions (colors.json `extensions`): same names, same values. */
const EXTENSIONS = Object.keys(kit.extensions.light) as (keyof typeof kit.extensions.light)[];

/** Runtime tokens the kit does not have, used for runtime layout and subdued text. */
const DEVIATIONS = ["hairline"];

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
    const known = new Set([...Object.values(KIT_TO_RUNTIME), ...EXTENSIONS, ...DEVIATIONS]);
    expect(declared.filter((name) => !known.has(name))).toEqual([]);
    for (const name of DEVIATIONS) expect(declared).toContain(name);
  });

  it("has the kit's studio extensions with the kit's values", () => {
    expect(Object.keys(kit.extensions.dark).sort()).toEqual([...EXTENSIONS].sort());
    for (const name of EXTENSIONS) {
      expect(pair(name), `--ui-${name}`).toEqual({ light: kit.extensions.light[name].toLowerCase(), dark: kit.extensions.dark[name].toLowerCase() });
    }
  });

  it("draws the wordmark in the kit's light and dark inks", () => {
    expect(runtime).toContain(`--brand-wordmark: light-dark(${kit.brand.plum.toLowerCase()}, ${kit.dark["text-primary"].toLowerCase()});`);
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

describe("the public sites", () => {
  it("take their colours from the brand tokens, with no hex values of their own", () => {
    const css = readFileSync(new URL("../src/concept/site/site.module.css", import.meta.url), "utf8");
    expect(css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});

describe("neutral text on tinted backgrounds", () => {
  const TONES = "success|warning|danger|info|action|staff-1|staff-2";
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? files(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
    });

  it("never pairs a tint with text in the tint's own colour in one class list", () => {
    const root = path.join(__dirname, "..", "src");
    const offenders: string[] = [];
    for (const file of [...files(path.join(root, "concept")), ...files(path.join(root, "app", "studio")), ...files(path.join(root, "app", "boka"))]) {
      // One string literal is one class list (cx() arguments are separate literals for separate states).
      for (const [literal] of readFileSync(file, "utf8").matchAll(/"[^"\n]*"|`[^`]*`/g)) {
        const tint = literal.match(new RegExp(`(?<![\\w:-])bg-(${TONES})-bg\\b`));
        if (tint && new RegExp(`(?<![\\w-])text-${tint[1]}(?![\\w-])`).test(literal)) offenders.push(`${path.relative(root, file)}: ${literal.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("foundation scales", () => {
  it("maps the layout, type, depth and motion scales to runtime tokens", async () => {
    const { default: config } = await import("../tailwind.config");
    const theme = config.theme.extend;
    const cssValue = (token: string) => runtime.match(new RegExp(token + ": ([^;]+);"))?.[1];
    for (const n of [1, 2, 3, 4, 6, 8]) {
      expect(Reflect.get(theme.spacing, n)).toBe(`var(--space-${n})`);
      expect(cssValue(`--space-${n}`)).toBe(`${4 * n}px`);
    }
    for (const [role, px] of Object.entries({ h1: 28, h2: 20, h3: 16, body: 15, meta: 13, min: 12 })) {
      expect(cssValue("--type-" + role)).toBe(px / 16 + "rem");
      expect(theme.fontSize[role === "min" ? "minimum" : role as keyof typeof theme.fontSize][0]).toBe(`var(--type-${role})`);
    }
    for (const [index, duration] of [120, 200, 280].entries()) expect(cssValue("--dur-" + (index + 1))).toBe(duration + "ms");
    expect(cssValue("--ease-out")).toBe("cubic-bezier(.2,.8,.2,1)");
    for (const scale of [theme.boxShadow, theme.zIndex, theme.transitionTimingFunction, theme.transitionDuration]) {
      for (const value of Object.values(scale)) expect(cssValue(value.slice(4, -1))).toBeTruthy();
    }
    expect(cssValue("--touch-target")).toBe("44px");
    expect(runtime).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation-duration: .01ms/);
  });

  it("keeps control labels, secondary copy and focus indicators readable in both themes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const ratio = (a: string, b: string) => contrast(pair(a)[scheme], pair(b)[scheme]);
      for (const surface of ["bg", "surface", "surface-2", "action-bg"]) {
        expect(ratio("text-secondary", surface)).toBeGreaterThanOrEqual(4.5);
        expect(ratio("focus", surface)).toBeGreaterThanOrEqual(3);
        expect(ratio("input-border", surface)).toBeGreaterThanOrEqual(3);
      }
      for (const fill of ["action", "action-hover"]) expect(ratio("action-text", fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
