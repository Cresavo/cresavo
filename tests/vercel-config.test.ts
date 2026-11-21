import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Vercel rejects a deployment whose buildCommand exceeds 256 characters, before any
// build log exists. That silently stopped every deployment once.
it("keeps every Vercel buildCommand within Vercel's 256-character limit", () => {
  for (const file of ["vercel.json", "vercel.sandbox.json"]) {
    const config = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")) as { buildCommand?: string };
    expect(config.buildCommand?.length ?? 0, file).toBeLessThanOrEqual(256);
  }
});
