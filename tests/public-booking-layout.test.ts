import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";

// The booking layout decides demo or live before anything else: the demo never
// reaches a rate store or the database, and a live address is the server's or a
// 404, never the browser's own copy. Fictional data only.

const ctx = vi.hoisted(() => ({ headers: {} as Record<string, string>, calls: [] as string[], load: undefined as undefined | ((slug: string) => Promise<unknown>) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(ctx.headers),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async (route: string) => { ctx.calls.push(`rate:${route}`); } }));
vi.mock("@/lib/public-booking", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadPublicSalon: async (slug: string) => { ctx.calls.push(`load:${slug}`); return ctx.load!(slug); },
}));
vi.mock("@/concept/booking/shell", () => ({ BookShell: () => null }));
vi.mock("../src/app/studio/studio.css", () => ({}));

const salon = createDemoState("2026-11-16");

/** The names of every component in a rendered element tree. */
function names(node: ReactNode): string[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(names);
  const element = node as ReactElement<{ children?: ReactNode; state?: unknown }>;
  const own = typeof element.type === "function" ? [element.type.name] : [];
  return [...own, ...names(element.props?.children)];
}

async function layout(slug: string) {
  const { default: BookingLayout } = await import("@/app/boka/[slug]/layout");
  return BookingLayout({ children: null, params: Promise.resolve({ slug }) });
}

const live = () => {
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
};

beforeEach(() => {
  ctx.headers = { host: "localhost" };
  ctx.calls = [];
  ctx.load = async () => salon;
});
afterEach(() => vi.unstubAllEnvs());

describe("booking layout", () => {
  it("is the browser demo with the flags off, touching no store", async () => {
    const tree = await layout("salong-eko");
    expect(names(tree)).toContain("BookShell");
    expect(names(tree)).not.toContain("ServerSalonProvider");
    expect(ctx.calls).toEqual([]);
  });

  it("is the browser demo on the demo's own host even with the flags on", async () => {
    live();
    ctx.headers = { host: "demo.book.example" };
    expect(names(await layout("salong-eko"))).not.toContain("ServerSalonProvider");
    expect(ctx.calls).toEqual([]);
  });

  it("is the browser demo in the demo build, whatever PUBLIC_READONLY says", async () => {
    live();
    vi.stubEnv("NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO", "1");
    vi.stubEnv("PUBLIC_READONLY", "0");
    expect(names(await layout("salong-eko"))).not.toContain("ServerSalonProvider");
    expect(ctx.calls).toEqual([]);
  });

  it("serves a found salon from the server, charging the read once before the lookup, with the address in lower case", async () => {
    live();
    const tree = await layout("Salong-Fiktiv");
    expect(names(tree)).toEqual(expect.arrayContaining(["ServerSalonProvider", "BookShell"]));
    expect(ctx.calls).toEqual(["rate:public-read", "load:salong-fiktiv"]);
  });

  it("is a 404 for an unknown live address, never the browser's own copy", async () => {
    live();
    ctx.load = async () => null;
    await expect(layout("salong-okand")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is an unavailable page when the store fails, never the browser's own copy", async () => {
    live();
    ctx.load = async () => { throw new Error("db down"); };
    const tree = await layout("salong-fiktiv");
    expect(names(tree)).not.toContain("BookShell");
    expect(JSON.stringify(tree)).toContain("temporarily unavailable");
  });

  it("keeps demo-only customer pages for the demo: a live salon has none", async () => {
    const { demoOnly } = await import("@/lib/public-page");
    await expect(demoOnly()).resolves.toBeUndefined();
    live();
    await expect(demoOnly()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
