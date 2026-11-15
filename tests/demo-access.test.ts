import { describe, expect, it } from "vitest";
import {
  demoAccessEnabled,
  demoDatabaseFingerprint,
} from "../src/lib/demo-access";
const url = "postgresql://synthetic@127.0.0.1/isolated_demo";
const enabled = {
  ...process.env,
  BOOKING_DEMO_ACCESS: "1",
  BOOKING_RUNTIME: "vercel",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "preview-project",
  BOOKING_DEMO_PROJECT_ID: "preview-project",
  DATABASE_URL: url,
  BOOKING_DEMO_DATABASE: demoDatabaseFingerprint(url),
};
describe("snävt avgränsad demoåtkomst", () => {
  it("kräver hela explicita previewkonfigurationen", () => {
    expect(demoAccessEnabled(enabled)).toBe(true);
    for (const key of [
      "BOOKING_DEMO_ACCESS",
      "BOOKING_RUNTIME",
      "VERCEL",
      "VERCEL_ENV",
      "VERCEL_PROJECT_ID",
      "BOOKING_DEMO_PROJECT_ID",
      "BOOKING_DEMO_DATABASE",
      "DATABASE_URL",
    ])
      expect(demoAccessEnabled({ ...enabled, [key]: "" })).toBe(false);
  });
  it("nekar produktion, annan databas/projekt och libpq-omdirigering", () => {
    for (const patch of [
      { VERCEL_ENV: "production" },
      { VERCEL_ENV: "development" },
      { BOOKING_RUNTIME: "local" },
      { VERCEL_PROJECT_ID: "other" },
      { DATABASE_URL: url + "2" },
      { DATABASE_URL: url + "?HOST=other" },
      { DATABASE_URL: url + "?port=6543" },
      { DATABASE_URL: url + "?%50ORT=6543" },
    ])
      expect(demoAccessEnabled({ ...enabled, ...patch })).toBe(false);
    expect(
      demoAccessEnabled({ ...process.env, BOOKING_DEMO_ACCESS: undefined }),
    ).toBe(false);
  });
  it("fingeravtrycket innehåller inte lösenordet och tål rotation", () => {
    expect(demoDatabaseFingerprint(url)).toBe(
      demoDatabaseFingerprint(url.replace("synthetic@", "other:new-password@")),
    );
  });
});
