import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contrast } from "@/concept/page/colour";
import { Badge, Tag } from "@/concept/ui/badge";
import { Notice } from "@/concept/ui/notice";

// Status words are quiet: text only. No fill, no dot, and the one signal a
// warning or an error gets is its semantic colour on the text.

const runtime = readFileSync(new URL("../src/concept/ui/brand-theme.css", import.meta.url), "utf8");
const tenant = readFileSync(new URL("../src/concept/booking/tenant-theme.css", import.meta.url), "utf8");

function pair(name: string): { light: string; dark: string } {
  const match = runtime.match(new RegExp(`--ui-${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, "i"));
  if (!match) throw new Error(`--ui-${name} is not a light-dark() pair`);
  return { light: match[1], dark: match[2] };
}

const html = (tone?: "neutral" | "accent" | "warn" | "danger") => renderToStaticMarkup(createElement(Badge, { tone, children: "Status" }));

describe("status badges", () => {
  it("are plain text by default: no background, no outline, no dot", () => {
    for (const tone of [undefined, "neutral", "accent", "warn", "danger"] as const) {
      const markup = html(tone);
      expect(markup).not.toMatch(/\bbg-|\bring-|rounded-full|size-1\.5/);
      expect(markup.match(/<span/g)).toHaveLength(1);
    }
    expect(html()).toContain("text-text-secondary");
    expect(html("accent")).toContain("text-text");
  });

  it("give a warning or an error exactly one signal: the semantic colour on the text", () => {
    expect(html("warn")).toContain("text-warning");
    expect(html("warn")).toContain('data-status="warning"');
    expect(html("danger")).toContain("text-danger");
    expect(html("danger")).toContain('data-status="danger"');
    expect(html("neutral")).not.toContain("data-status");
  });

  it("keep that colour readable (WCAG AA) on every ground, light and dark", () => {
    for (const tone of ["warning", "danger", "text-secondary"]) {
      for (const ground of ["bg", "surface", "surface-2"]) {
        for (const scheme of ["light", "dark"] as const) {
          expect(contrast(pair(tone)[scheme], pair(ground)[scheme]), `${tone} on ${ground}, ${scheme}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("cannot be recoloured or filled by a business's own CSS on its booking page", () => {
    expect(tenant).toMatch(/\[data-status="warning"\]\s*{\s*color: var\(--ui-warning\) !important/);
    expect(tenant).toMatch(/\[data-status="danger"\]\s*{\s*color: var\(--ui-danger\) !important/);
    expect(tenant).toMatch(/\[data-status\]\s*{[^}]*background: none !important/);
  });

  it("have an outlined, unfilled chip for labels that are not a status", () => {
    const markup = renderToStaticMarkup(createElement(Tag, { children: "Regular" }));
    expect(markup).toContain("ring-hairline");
    expect(markup).not.toMatch(/\bbg-/);
  });
});

describe("notices", () => {
  it("show plain information on the neutral surface, and keep the semantic tint for real states", () => {
    const info = renderToStaticMarkup(createElement(Notice, { tone: "info", children: "Note" }));
    expect(info).toContain("bg-surface-2");
    expect(info).not.toContain("data-tone=");
    const warning = renderToStaticMarkup(createElement(Notice, { tone: "warning", children: "Careful" }));
    expect(warning).toContain('data-tone="warning"');
    expect(warning).toContain("bg-warning-bg");
    expect(warning).toContain("text-text");
  });
});
