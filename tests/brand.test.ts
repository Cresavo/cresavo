import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ASSISTANT, BRAND } from "@/concept/brand";
import { en } from "@/concept/i18n/en";

const SRC = path.join(__dirname, "..", "src");
const BRAND_FILE = path.join(SRC, "concept", "brand.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : /\.(tsx?|css|json|txt)$/.test(entry.name) ? [full] : [];
  });
}

describe("one brand constant", () => {
  it("names the product, its tagline and the assistant", () => {
    expect(BRAND).toEqual({ name: "Libovo", tagline: "More time. Your terms." });
    // The assistant keeps its own name until the product owner decides.
    expect(ASSISTANT).toEqual({ name: "Flerdo" });
  });

  it.each([["product", BRAND.name], ["assistant", ASSISTANT.name]])("is the only place in src that spells out the %s name", (_, name) => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== BRAND_FILE && readFileSync(file, "utf8").includes(name))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("flows into the dictionary, so a rename is one edit", async () => {
    expect(en.messages["assistant.open"]).toBe(`Ask ${ASSISTANT.name}`);
    expect(en.messages["features.core"]).toBe(`${BRAND.name} core`);
    vi.resetModules();
    vi.doMock("@/concept/brand", () => ({ BRAND: { name: "Zorp", tagline: "Zip." }, ASSISTANT: { name: "Quux" } }));
    const renamed = (await import("@/concept/i18n/en")).en.messages;
    vi.doUnmock("@/concept/brand");
    expect(renamed["assistant.open"]).toBe("Ask Quux");
    expect(renamed["features.core"]).toBe("Zorp core");
    expect(Object.values(renamed).some((text) => text.includes(BRAND.name) || text.includes(ASSISTANT.name))).toBe(false);
  });
});
