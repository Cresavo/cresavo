import type { GetServerSidePropsContext } from "next";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getSiteProps } from "../src/concept/site/links";
import { proxy } from "../src/proxy";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", "cresavo.com");
  vi.stubEnv("PUBLIC_READONLY", "1");
  vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("TRUST_PROXY_IP", undefined);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", undefined);
});
afterEach(() => vi.unstubAllEnvs());

const publicLinks = { apex: "https://cresavo.com/", demo: "https://demo.cresavo.com/studio" };
const internalHost = { host: "localhost:3100" };

function siteProps(headers: Record<string, string>) {
  return getSiteProps({ req: { headers }, query: {} } as GetServerSidePropsContext);
}

function routed(path: string, headers: Record<string, string> = internalHost) {
  return proxy(new NextRequest(`http://localhost:3100${path}`, { headers })).headers;
}

it("uses the configured links and allows the rewritten coming-soon page to be indexed", async () => {
  await expect(siteProps(internalHost)).resolves.toEqual({ props: { links: publicLinks, waitlist: null } });
  expect(routed("/coming-soon").get("X-Robots-Tag")).toBeNull();
  expect(routed("/").get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(routed("/landing").get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(routed("/coming-soon", { host: "cresavo-preview.vercel.app" }).get("X-Robots-Tag")).toBe("noindex, nofollow");
});

it("keeps local development in the same studio even with a product domain configured", async () => {
  vi.stubEnv("NODE_ENV", "development");
  await expect(siteProps(internalHost)).resolves.toMatchObject({ props: { links: { demo: "/studio" } } });
});

it("keeps same-deployment links on a preview deployment", async () => {
  await expect(siteProps({ host: "cresavo-preview.vercel.app" })).resolves
    .toMatchObject({ props: { links: { apex: "/coming-soon", demo: "/studio" } } });
});

it("prefers Vercel's forwarded host for links and host routing", async () => {
  vi.stubEnv("BOOKING_RUNTIME", "vercel");
  vi.stubEnv("VERCEL", "1");
  const apex = { ...internalHost, "x-forwarded-host": "www.cresavo.com" };
  const demo = { ...internalHost, "x-forwarded-host": "demo.cresavo.com" };
  await expect(siteProps(apex)).resolves.toMatchObject({ props: { links: publicLinks } });
  await expect(siteProps(demo)).resolves.toMatchObject({ props: { links: publicLinks } });
  expect(routed("/", apex).get("x-middleware-rewrite")).toBe("http://localhost:3100/coming-soon");
  expect(routed("/", apex).get("X-Robots-Tag")).toBeNull();
  expect(routed("/?from=home", demo).get("location")).toBe("http://demo.cresavo.com/studio?from=home");
  expect(routed("/", demo).get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(routed("/", { ...internalHost, "x-forwarded-host": "cresavo.com, demo.cresavo.com" }).get("X-Robots-Tag")).toBe("noindex, nofollow");

  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", undefined);
  await expect(siteProps({ ...internalHost, "x-forwarded-host": "demo.book.example" })).resolves
    .toMatchObject({ props: { links: { apex: "https://book.example/", demo: "https://demo.book.example/studio" } } });
});

it("requires the socket server's verified forwarding in local mode", async () => {
  vi.stubEnv("TRUST_PROXY_IP", "1");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-unit-test");
  const unverified = { ...internalHost, "x-forwarded-host": "cresavo.com" };
  expect(routed("/", unverified).get("X-Robots-Tag")).toBe("noindex, nofollow");
  const verified = { ...internalHost, "x-booking-forwarded-host": "cresavo.com" };
  expect(routed("/", verified).get("X-Robots-Tag")).toBeNull();
});

it("keeps links local when a product domain is unset and forwarding is untrusted", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", undefined);
  const headers = { ...internalHost, "x-forwarded-host": "book.example", "x-booking-forwarded-host": "book.example" };
  await expect(siteProps(headers)).resolves.toMatchObject({ props: { links: { apex: "/coming-soon", demo: "/studio" } } });
  expect(routed("/", headers).get("X-Robots-Tag")).toBe("noindex, nofollow");
});
