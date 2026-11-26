import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/concept/ui/empty-state";
import { SkeletonCard, SkeletonGroup, SkeletonRow, StatusDot } from "@/concept/ui/feedback";
import { ActionMenu, Popover, popoverPlacement, popoverStack } from "@/concept/ui/popover";

// Menus that grow from their trigger, the sliding tab mark, shaped skeletons, calm empty states and quiet status dots.

const theme = readFileSync(new URL("../src/concept/ui/brand-theme.css", import.meta.url), "utf8");
const studio = readFileSync(new URL("../src/app/studio/studio.css", import.meta.url), "utf8");
const reduced = theme.slice(theme.indexOf("@media (prefers-reduced-motion: reduce)"));
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("popover and action menu", () => {
  it("start closed with a trigger that names its popup", () => {
    const menu = html(createElement(ActionMenu, { title: "Quick actions", icon: "+", items: [{ label: "New booking", run: () => undefined }] }));
    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain('aria-expanded="false"');
    expect(menu).toContain('aria-label="Quick actions"');
    expect(menu).not.toContain('role="menu"');
    const panel = html(createElement(Popover, { title: "Calendar options", icon: "…", children: "Rooms" })) // eslint-disable-line react/no-children-prop -- createElement typings require children on the props object;
    expect(panel).toContain('aria-haspopup="dialog"');
    expect(panel).not.toContain("Rooms");
  });

  it("grow from the trigger's side and fold back, with only a fade under reduced motion", () => {
    expect(theme).toMatch(/\.ui-pop \{[^}]*min-width: min\(14rem, calc\(100vw - 2 \* var\(--space-4\)\)\);/);
    expect(theme).toMatch(/\.ui-pop \{[^}]*transform-origin: top right/);
    expect(theme).toMatch(/\.ui-pop\[data-side="start"\] \{ transform-origin: top left; \}/);
    expect(theme).toMatch(/\.ui-pop\[data-closing\] \{ animation: ui-pop-leave var\(--dur-1\) var\(--ease-in\)/);
    expect(reduced).toMatch(/\.ui-pop, \[data-row-motion\] \{ animation-name: ui-fade;/);
  });
  it("clamps the panel inside the viewport when neither edge has room", () => {
    const place = popoverPlacement("end", { left: 140, right: 180 }, 224, 320);
    expect(place.width).toBe(224);
    expect(place.left).toBe(16);
    expect(place.left + place.width).toBeLessThanOrEqual(304);
    const wide = popoverPlacement("start", { left: 8, right: 40 }, 400, 320);
    expect(wide.left).toBe(16);
    expect(wide.width).toBe(288);
    expect(wide.left + wide.width).toBe(304);
  });

  it("opens above the trigger when there is more room there, and caps its height", () => {
    const below = popoverStack({ top: 40, bottom: 72 }, 160, 400);
    expect(below.placement).toBe("below");
    expect(below.top).toBe(80);
    expect(below.height).toBe(160);
    const above = popoverStack({ top: 300, bottom: 332 }, 200, 360);
    expect(above.placement).toBe("above");
    expect(above.top).toBeGreaterThanOrEqual(16);
    expect(above.top + above.height).toBe(292);
    const tight = popoverStack({ top: 200, bottom: 232 }, 300, 280);
    expect(tight.placement).toBe("above");
    expect(tight.top).toBe(16);
    expect(tight.height).toBe(176);
  });

});



describe("tab bar", () => {
  it("moves one mark with a transform on the motion tokens", () => {
    expect(studio).toMatch(/\.studio-tab-indicator \{[^}]*transform: translateX\(calc\(var\(--tab-index\) \* 100%\)\);[^}]*transition: transform var\(--dur-2\) var\(--ease-out\);/);
  });
});

describe("skeletons", () => {
  it("announce one loading label for a whole silhouette", () => {
    const markup = html(createElement(SkeletonGroup, null, createElement(SkeletonRow), createElement(SkeletonCard)));
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain(">Loading</span>");
    expect(markup).toContain("ui-skeleton");
  });
});

describe("empty states", () => {
  it("keep one decorative icon without a plate, fading in once", () => {
    const markup = html(createElement(EmptyState, { icon: "i", title: "Nothing here" }));
    expect(markup).toContain('aria-hidden="true" class="ui-empty-icon');
    expect(markup).not.toMatch(/\bbg-|\bring-|\bborder\b|rounded/);
    expect(theme).toMatch(/\.ui-empty-icon \{ animation: ui-fade var\(--dur-3\) var\(--ease-out\) both; \}/);
    expect(theme).not.toMatch(/\.ui-empty-icon[^}]*infinite/);
  });
});

describe("status dots", () => {
  it("are decorative, in the text's colour, and hold still with reduced motion", () => {
    expect(html(createElement(StatusDot))).toBe('<span aria-hidden="true" class="ui-dot"></span>');
    expect(html(createElement(StatusDot, { kind: "progress" }))).toBe('<span aria-hidden="true" class="ui-fill"></span>');
    expect(theme).toMatch(/\.ui-dot \{ background: currentColor;/);
    expect(theme).toMatch(/\.ui-fill::after \{[^}]*background: currentColor;/);
    expect(reduced).toMatch(/\.ui-skeleton, \.ui-dot, \.ui-fill::after \{ animation: none; \}/);
  });
});
