import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BRAND } from "@/concept/brand";
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
  it("names the product and its tagline", () => {
    expect(BRAND).toEqual({ name: "Flerdo", tagline: "Do more, click less." });
  });

  it("is the only place in src that spells out the product name", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== BRAND_FILE && readFileSync(file, "utf8").includes(BRAND.name))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("flows into the dictionary, so a rename is one edit", async () => {
    expect(en.messages["command.placeholder"]).toBe(`Ask ${BRAND.name}… what would you like to do?`);
    vi.resetModules();
    vi.doMock("@/concept/brand", () => ({ BRAND: { name: "Zorp", tagline: "Zip." } }));
    const renamed = (await import("@/concept/i18n/en")).en.messages;
    vi.doUnmock("@/concept/brand");
    expect(renamed["command.placeholder"]).toBe("Ask Zorp… what would you like to do?");
    expect(renamed["features.core"]).toBe("Zorp core");
    expect(Object.values(renamed).some((text) => text.includes(BRAND.name))).toBe(false);
  });
});
