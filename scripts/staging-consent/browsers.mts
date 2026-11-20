// Customer and owner browsers. Each scenario uses its own fresh context, so no cookie,
// storage or history is shared with the agent, the operator or another scenario.
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "@playwright/test";

export async function launchBrowser(host: string, spki: string) {
  return chromium.launch({
    ...(process.env.STAGING_CHROMIUM_PATH ? { executablePath: process.env.STAGING_CHROMIUM_PATH } : {}),
    // No proxy, only this host on loopback, and only this run's leaf certificate trusted.
    args: ["--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`, `--ignore-certificate-errors-spki-list=${spki}`],
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp" },
  });
}

export type ConsentView = { page: Page; state: string; terms: Record<string, string>; buttons: number };
const settled = '[data-consent-state]:not([data-consent-state="loading"])';

/** Opens the customer's link and waits until the page has read the proposal. */
export async function openConsent(browser: Browser, link: string): Promise<ConsentView> {
  const context = await browser.newContext({ locale: "en-GB" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(link);
  await page.locator(settled).waitFor({ state: "attached" });
  // The one-time secret is removed from the address bar before anything else happens.
  assert.equal(new URL(page.url()).hash, "");
  const state = (await page.locator(settled).getAttribute("data-consent-state"))!;
  const terms: Record<string, string> = {};
  for (const term of await page.locator("dd[data-term]").all())
    terms[(await term.getAttribute("data-term"))!] = (await term.innerText()).trim();
  const buttons = await page.getByRole("button", { name: /^(Approve this booking|Decline)$/ }).count();
  return { page, state, terms, buttons };
}

export async function decide(view: ConsentView, decision: "approve" | "decline") {
  await view.page.getByRole("button", { name: decision === "approve" ? "Approve this booking" : "Decline", exact: true }).click();
  await view.page.locator(`[data-consent-state="${decision === "approve" ? "approved" : "declined"}"]`).waitFor({ state: "attached" });
  assert.equal(await view.page.locator("dd[data-term]").count(), 0);
}

export async function close(view: ConsentView) { await view.page.context().close(); }

/** Formats in the browser with fixed options, independent of the page's own rendering code. */
export function expectedText(page: Page, input: { start: string; expiresAt: string; amountMinor: number; currency: string; timeZone: string }) {
  return page.evaluate(i => ({
    date: new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, dateStyle: "full" }).format(new Date(i.start)),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, timeStyle: "short" }).format(new Date(i.start)),
    expires: new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(i.expiresAt)),
    price: new Intl.NumberFormat("en-GB", { style: "currency", currency: i.currency }).format(i.amountMinor / 100),
  }), input);
}

/** An owner logs in through the salon's HTTPS form and opens exactly this booking from the calendar. */
export async function ownerOpensBooking(browser: Browser, salon: string, day: string, bookingId: string, email: string, password: string) {
  const context = await browser.newContext({ locale: "en-GB" });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(`${salon}/admin?view=day&date=${day}`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator("form").filter({ has: page.locator("#password") }).getByRole("button").click();
    const path = `/admin/bookings/${bookingId}`;
    await page.locator(`a[href^="${path}"]:visible`).first().click();
    await page.waitForURL(url => url.origin === salon && url.pathname === path);
    await page.getByRole("heading", { name: /^(Booking|Bokning)$/ }).waitFor();
    const cookies = await context.cookies(salon);
    assert.ok(cookies.some(c => c.name === "booking_admin" && c.secure && c.httpOnly), "owner session cookie is Secure and HttpOnly");
  } finally { await context.close(); }
}
