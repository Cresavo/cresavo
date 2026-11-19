import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { updateApiParityTable } from "../scripts/api-parity-table.mjs";
import { CORE_API } from "../src/concept/modules/api-parity";
import { MODULES } from "../src/concept/modules/registry";

describe("concept API parity", () => {
  it.each(MODULES)("declares API resources for $id", ({ api }) => {
    expect(Array.isArray(api)).toBe(true);
    expect(api.length).toBeGreaterThan(0);
  });

  it("uses unique resource names across the core and modules", () => {
    const resources = [...CORE_API, ...MODULES.flatMap(({ api }) => api)];
    const names = resources.map(({ resource }) => resource);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps the API platform table in sync with the declarations", () => {
    const markdown = readFileSync(new URL("../docs/design/API_PLATFORM.md", import.meta.url), "utf8");
    expect(markdown, "Run node --import tsx scripts/api-parity-table.mjs to regenerate the table.")
      .toBe(updateApiParityTable(markdown));
  });
});
