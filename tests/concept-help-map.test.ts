import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_MAP, helpSteps } from "@/concept/help/map/entries";
import { en } from "@/concept/i18n/en";
import { sv } from "@/concept/i18n/sv";

// The help map must match the studio's source, so it cannot drift: every entry has an element with its
// `data-help-id` (or a `helpId` prop or nav field that renders one), every such id is in the map, and every route is
// a real page. The browser check that the anchors actually render is tests/concept-e2e/help-map.spec.ts.

const ANCHOR = /(?:data-help-id|helpId)\s*[=:]\s*\{?\s*"([^"]+)"/g;

function sourceAnchors(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const root of ["src/app/studio", "src/concept/studio", "src/concept/ui"]) {
    for (const file of readdirSync(root, { encoding: "utf8", recursive: true })) {
      if (!/\.tsx?$/.test(file)) continue;
      const path = join(root, file);
      for (const match of readFileSync(path, "utf8").matchAll(ANCHOR)) found.set(match[1], [...(found.get(match[1]) ?? []), path]);
    }
  }
  return found;
}

const anchors = sourceAnchors();
const ids = new Set(HELP_MAP.map((entry) => entry.id));

function pageFile(route: string): string {
  return join("src/app", ...route.split("/").filter(Boolean), "page.tsx");
}

describe("help map", () => {
  it("covers the studio broadly with unique ids", () => {
    expect(HELP_MAP.length).toBeGreaterThanOrEqual(100);
    expect(ids.size).toBe(HELP_MAP.length);
    for (const entry of HELP_MAP) expect(entry.id, entry.id).toMatch(/^[a-z]+(?:[.-][a-z]+)+$/);
  });

  it("has an anchor in the source for every entry", () => {
    expect(HELP_MAP.filter((entry) => !anchors.has(entry.id)).map((entry) => entry.id)).toEqual([]);
  });

  it("lists every anchor in the source", () => {
    expect([...anchors.keys()].filter((id) => !ids.has(id)).map((id) => `${id} (${anchors.get(id)})`)).toEqual([]);
  });

  it("points every entry at a studio page that exists", () => {
    for (const entry of HELP_MAP) {
      expect(entry.route, entry.id).toMatch(/^\/studio(\/|$)/);
      expect(existsSync(pageFile(entry.route)), `${entry.id}: ${pageFile(entry.route)}`).toBe(true);
    }
  });

  it("builds each path from known entries the guide may click, without loops", () => {
    for (const entry of HELP_MAP) {
      expect(entry.path, entry.id).not.toContain(entry.id);
      for (const step of entry.path) {
        const known = HELP_MAP.find((other) => other.id === step);
        expect(known, `${entry.id} → ${step}`).toBeDefined();
        // The guide clicks a step for the owner, so a step on the way can only open a page or a view.
        expect(known?.safety, `${entry.id} → ${step}`).toBe("navigate");
      }
      expect(helpSteps(entry.id).at(-1)).toBe(entry);
      expect(helpSteps(entry.id)).toHaveLength(entry.path.length + 1);
    }
  });

  it("marks what changes data as changes-data", () => {
    const changes = /\.(new-booking|move|cancel|take-payment|mark-done|delete|reset-demo|add|reply|copy|download|sell|start-over)$/;
    for (const entry of HELP_MAP) if (changes.test(entry.id)) expect(entry.safety, entry.id).toBe("changes-data");
  });

  it("has a name, caption and search words in both languages", () => {
    const english: Record<string, string> = en.messages;
    const swedish: Record<string, string> = sv.messages;
    for (const entry of HELP_MAP) {
      for (const key of [entry.label, `showMe.${entry.id}.hint`, `showMe.${entry.id}.keywords`]) {
        expect(english[key], `${key} (en)`).toBeTruthy();
        expect(swedish[key], `${key} (sv)`).toBeTruthy();
      }
    }
  });
});
