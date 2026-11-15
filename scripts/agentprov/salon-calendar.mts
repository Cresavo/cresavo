import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { createAdminUser } from "../../src/lib/admin-accounts";
import { db } from "../../src/lib/db";
import { assertTestDatabase } from "../test-db-guard.mjs";

export async function checkSalonCalendar(address: string, gateway: URL, bookingId: string, start: string) {
  assertTestDatabase();
  const salon = new URL(address);
  assert.equal(salon.protocol, "http:");
  assert.equal(salon.hostname, "127.0.0.1");
  assert.equal(address.replace(/\/$/, ""), salon.origin);
  assert.notEqual(salon.origin, gateway.origin);
  const get = (path: string, options: RequestInit = {}) =>
    fetch(new URL(path, salon.origin), { ...options, redirect: "error" });
  assert.equal((await get("/api/v1/mcp")).status, 404, "salon must have its embedded MCP disabled");
  const email = "split-" + randomUUID() + "@example.test";
  const password = randomUUID() + randomUUID();
  const user = await createAdminUser(email, password);
  try {
    const login = await get("/api/admin/login", { method: "POST", headers: {
      origin: salon.origin, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find(value => value.startsWith("booking_admin="))?.split(";")[0];
    assert.ok(cookie);
    const day = DateTime.fromISO(start).setZone("Europe/Stockholm").toISODate();
    const path = "/admin?view=day&date=" + day;
    const anon = await get(path);
    assert.ok(!(await anon.text()).includes(bookingId));
    const calendar = await get(path, { headers: { cookie } });
    assert.equal(calendar.status, 200);
    assert.ok((await calendar.text()).includes("/admin/bookings/" + bookingId), "calendar has the exact booking link");
    const logout = await get("/api/admin/logout", { method: "POST", headers: { cookie, origin: salon.origin } });
    assert.equal(logout.status, 200);
    // Start a fresh browser with none of the HTTP test's cookies.
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
      await page.goto(new URL(path, salon.origin).href);
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.locator("form").filter({ has: page.locator("#password") }).getByRole("button").click();
      const bookingPath = "/admin/bookings/" + bookingId;
      await page.locator(`a[href^="${bookingPath}"]:visible`).first().click();
      await page.waitForURL(url => url.origin === salon.origin && url.pathname === bookingPath);
      await page.getByRole("heading", { name: /^(Booking|Bokning)$/ }).waitFor();
    } finally {
      await browser.close();
    }
  } finally {
    await db.$transaction([db.adminSession.deleteMany({ where: { userId: user.id } }), db.adminUser.delete({ where: { id: user.id } })]);
  }
}
