import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Server routes must never reach a "use client" module: Next.js turns such an
// import into a client reference on the server, so code that works under
// Vitest fails in the running app (the MCP tools answered internal_error when
// the assistant's proposals imported the browser store).

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const candidate of [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, "index" + ext))])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm;

function clientModulesReachedFrom(entry: string): string[] {
  const seen = new Set<string>();
  const clients: string[] = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    if (/^\s*["']use client["']/.test(source)) clients.push(file.slice(ROOT.length + 1));
    for (const match of source.matchAll(IMPORT)) {
      const next = resolveImport(file, match[1]);
      if (next) queue.push(next);
    }
  }
  return clients;
}

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routes(path);
    return name === "route.ts" ? [path] : [];
  });
}

describe("server routes and client-only modules", () => {
  const entries = [...routes(join(SRC, "app", "api", "concept")), ...routes(join(SRC, "app", "api", "public")), ...routes(join(SRC, "app", "api", "owner"))];

  it("finds the routes to check", () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  it.each(entries.map((entry) => [entry.slice(ROOT.length + 1), entry]))("%s reaches no \"use client\" module", (_name, entry) => {
    expect(clientModulesReachedFrom(entry)).toEqual([]);
  });
});
