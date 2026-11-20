// Customer and owner browsers. Each scenario uses its own fresh context, so no cookie,
// storage or history is shared with the agent, the operator or another scenario.
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "@playwright/test";
import { registerSecret } from "./sanitize.mjs";
import { refuseRemoteBrowsers } from "./preflight.mjs";

/**
 * Chromium switches that map exactly the salon's host and TLS port to loopback, and everything else
 * (other hosts, IP literals, other ports of the salon host) to nothing.
 */
export function hostIsolation(host: string, port: number) {
  if (!/^[a-z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("STAGING_HOST_INVALID");
  const rules = `MAP ${host}:${port} 127.0.0.1:${port}, MAP * ~NOTFOUND`;
  return [`--host-rules=${rules}`, `--host-resolver-rules=${rules}`];
}

/**
 * A fresh context that also refuses, at the request level, anything outside the salon origin: a
 * second layer for the first request of every navigation, subresource and fetch.
 */
export async function salonContext(browser: Browser, origin: string) {
  const context = await browser.newContext({ locale: "en-GB" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort("blockedbyclient"));
  return context;
}

export async function launchBrowser(host: string, port: number, spki: string) {
  // Also here, so no caller can start a remote session: Playwright reads these from this
  // process's environment, not from the `env` given to the browser below.
  refuseRemoteBrowsers(process.env);
  return chromium.launch({
    ...(process.env.STAGING_CHROMIUM_PATH ? { executablePath: process.env.STAGING_CHROMIUM_PATH } : {}),
    // The runner owns these signals: Playwright's own handlers would close the browser and exit
    // the process before the runner has stopped its children, dropped the database and removed
    // the run directory with its keys and the gateway copy.
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    // No proxy, and only this run's leaf certificate trusted. Every destination except the salon
    // host is refused by the browser's network stack itself: `--host-rules` also applies to IP
    // literals and to every hop of a redirect, which a route handler does not see.
    args: ["--no-proxy-server", ...hostIsolation(host, port), `--ignore-certificate-errors-spki-list=${spki}`],
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp" },
  });
}

export type ConsentView = { page: Page; state: string; terms: Record<string, string>; buttons: number };
const settled = '[data-consent-state]:not([data-consent-state="loading"])';

/** Opens the customer's link and waits until the page has read the proposal. */
export async function openConsent(browser: Browser, link: string): Promise<ConsentView> {
  const context = await salonContext(browser, new URL(link).origin);
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

/**
 * Approves, but the response is lost after the salon has committed: the browser's request reaches
 * the salon, then the connection is reset before the page reads the answer. The page must show an
 * unknown outcome, and checking the status again must show the recorded approval.
 */
export async function approveWithLostResponse(view: ConsentView) {
  const { page } = view;
  // In the page itself: the browser's own request reaches the salon over its TLS connection, and
  // only then does the page see a network error, as when a connection drops after the commit.
  await page.evaluate(() => {
    const w = window as unknown as { __realFetch: typeof fetch; __committed?: number };
    w.__realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await w.__realFetch(input, init);
      if (typeof init?.body === "string" && init.body.includes('"decision":"yes"')) {
        w.__committed = response.status;
        throw new TypeError("Failed to fetch");
      }
      return response;
    };
  });
  await page.getByRole("button", { name: "Approve this booking", exact: true }).click();
  await page.locator('[data-consent-state="unconfirmed"]').waitFor({ state: "attached" });
  assert.equal(await page.evaluate(() => (window as unknown as { __committed?: number }).__committed), 200, "the salon saved the approval before the response was lost");
  assert.equal(await page.locator("dd[data-term]").count(), 0);
  await page.evaluate(() => { window.fetch = (window as unknown as { __realFetch: typeof fetch }).__realFetch; });
  await page.getByRole("button", { name: "Check status again", exact: true }).click();
  await page.locator('[data-consent-state="approvedEarlier"]').waitFor({ state: "attached" });
  assert.equal(await page.getByRole("button", { name: /^(Approve this booking|Decline|Check status again)$/ }).count(), 0);
}

// Runs in the browser. Plain JavaScript in a string, so the TypeScript loader cannot add helpers
// (such as `__name` for named functions) that do not exist in the page.
const EXPECTED_TEXT = String.raw`(i) => {
  const reading = at => new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, dateStyle: "short", timeStyle: "short" }).format(at);
  const ambiguous = at => [30, 60, 120].some(m => [-1, 1].some(sign => reading(new Date(+at + sign * m * 60000)) === reading(at)));
  const offset = at => {
    const name = new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, timeZoneName: "longOffset" }).formatToParts(at).find(p => p.type === "timeZoneName").value;
    return name === "GMT" ? "+00:00" : name.replace(/^GMT/, "");
  };
  // Seconds only when the instant has any.
  const style = at => at.getUTCSeconds() || at.getUTCMilliseconds() ? "medium" : "short";
  const exact = (text, at) => ambiguous(at) ? text + " (UTC" + offset(at) + ")" : text;
  const start = new Date(i.start), until = new Date(i.expiresAt);
  return {
    date: new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, dateStyle: "full" }).format(start),
    time: exact(new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, timeStyle: style(start) }).format(start), start),
    expires: exact(new Intl.DateTimeFormat("en-GB", { timeZone: i.timeZone, dateStyle: "medium", timeStyle: style(until) }).format(until), until),
    price: new Intl.NumberFormat("en-GB", { style: "currency", currency: i.currency }).format(i.amountMinor / 100),
  };
}`;

/**
 * Formats in the browser with fixed options, independent of the page's own rendering code. A local
 * time that also names another instant (the hour repeated when clocks go back) carries its UTC
 * offset, worked out here from Intl's own offset name rather than the page's helper.
 */
export function expectedText(page: Pick<Page, "evaluate">, input: { start: string; expiresAt: string; amountMinor: number; currency: string; timeZone: string }) {
  return page.evaluate(`(${EXPECTED_TEXT})(${JSON.stringify(input)})`) as Promise<{ date: string; time: string; expires: string; price: string }>;
}

/** An owner logs in through the salon's HTTPS form and opens exactly this booking from the calendar. */
export async function ownerOpensBooking(browser: Browser, salon: string, day: string, bookingId: string, email: string, password: string) {
  const context = await salonContext(browser, new URL(salon).origin);
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
  } finally {
    // The session cookie is a secret too, also when the journey failed after login: the final
    // scan of every process's output looks for it.
    for (const cookie of await context.cookies(salon).catch(() => [])) if (cookie.name === "booking_admin") registerSecret(cookie.value);
    await context.close();
  }
}

/**
 * Opens another link in the same tab. With the same path this is a fragment-only navigation:
 * the document stays, so the page itself must notice, take the new secret and read again.
 */
export async function reopenInSameTab(view: ConsentView, link: string, expected: string): Promise<ConsentView> {
  const { page } = view;
  await page.evaluate(() => { (window as unknown as { __sameDocument: boolean }).__sameDocument = true; });
  await page.evaluate(target => { window.location.href = target; }, link);
  // Times out (and fails the scenario) if the page never reads the reopened link.
  await page.locator(`[data-consent-state="${expected}"]`).waitFor({ state: "attached" });
  assert.equal(new URL(page.url()).hash, "", "secret removed from the address bar again");
  assert.equal(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument), true, "same document");
  const state = (await page.locator(settled).getAttribute("data-consent-state"))!;
  const terms: Record<string, string> = {};
  for (const term of await page.locator("dd[data-term]").all())
    terms[(await term.getAttribute("data-term"))!] = (await term.innerText()).trim();
  const buttons = await page.getByRole("button", { name: /^(Approve this booking|Decline)$/ }).count();
  return { page, state, terms, buttons };
}
