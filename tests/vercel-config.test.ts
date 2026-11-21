import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Vercel rejects a deployment whose buildCommand exceeds 256 characters, before any
// build log exists. That silently stopped every deployment once.
it("keeps every Vercel buildCommand within Vercel's 256-character limit", () => {
  for (const file of ["vercel.json", "vercel.sandbox.json"]) {
    const config = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")) as { buildCommand?: string };
    expect(config.buildCommand?.length ?? 0, file).toBeLessThanOrEqual(256);
  }
});

// .vercelignore uploads an allowlist. A build config added at the root without an
// allow rule exists locally and in CI but is missing on Vercel, and the build fails there.
it("uploads every root build config file to Vercel", () => {
  const root = new URL("../", import.meta.url);
  const allowed = readFileSync(new URL(".vercelignore", root), "utf8").split("\n")
    .filter((line) => line.startsWith("!/")).map((line) => line.slice(2));
  const matches = (file: string, rule: string) => new RegExp(`^${rule.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(file);
  const configs = readdirSync(root).filter((file) => /^(next|postcss|tailwind(\.[a-z]+)?|prisma(\.[a-z]+)?)\.config\.(ts|mjs|js|cjs)$/.test(file));
  expect(configs).toContain("tailwind.site.config.ts");
  for (const file of configs) expect(allowed.some((rule) => matches(file, rule)), file).toBe(true);
});
