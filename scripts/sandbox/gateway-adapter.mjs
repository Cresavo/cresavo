import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

export async function pinnedContext(browser, origin) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", async route => {
    if (new URL(route.request().url()).origin !== origin || route.request().redirectedFrom()) return route.abort();
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      if (response.status() >= 300 && response.status() < 400) return route.abort();
      return route.fulfill({ response });
    } catch {
      return route.abort();
    }
  });
  return context;
}

/** Ordinary browser access only. The gateway and provider credentials stay on their servers. */
export async function startHosted({ gatewayOrigin }) {
  const url = URL.parse(process.env.SANDBOX_PROVIDER_ORIGIN ?? "");
  if (!url || url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw Error("SANDBOX_TEST_ORIGIN_REQUIRED");
  const browser = await chromium.launch();
  try {
    const pairContext = await pinnedContext(browser, url.origin);
    const pair = await pairContext.newPage();
    await pair.goto(new URL("/sandbox", url).href);
    assert.equal(pair.url(), url.origin + "/sandbox");
    const expectedGateway = await pair.locator("#gateway-origin").getAttribute("data-origin");
    if (!expectedGateway || new URL(expectedGateway).protocol !== "https:" || gatewayOrigin !== expectedGateway)
      throw Error("SANDBOX_GATEWAY_ORIGIN_MISMATCH");
    await pair.locator("#issue").click();
    await pair.locator("#pair").waitFor();
    const agentKey = await pair.locator("#key").inputValue();
    const phoneLink = await pair.locator("#phone").getAttribute("href");
    const phoneUrl = URL.parse(phoneLink ?? "");
    assert.ok(phoneUrl && phoneUrl.origin === url.origin && phoneUrl.pathname === "/sandbox/phone" &&
      !phoneUrl.search && /^#[A-Za-z0-9_-]{43}$/.test(phoneUrl.hash));
    const customerContext = await pinnedContext(browser, url.origin);
    const phone = await customerContext.newPage();
    await Promise.all([phone.waitForResponse(response => {
      const responseUrl = new URL(response.url());
      return responseUrl.origin === url.origin && responseUrl.pathname === "/api/sandbox/phone" && response.ok();
    }), phone.goto(phoneUrl.href)]);
    await pairContext.close();
    return {
      agentKey,
      async approve(proposal) {
        await phone.locator("#refresh").click();
        const card = phone.locator("[data-proposal-id]").filter({ has: phone.getByRole("button", { name: "Approve this booking" }) });
        const valid = /^[0-9a-f-]{36}$/.test(proposal.id);
        assert.ok(valid);
        const expected = card.and(phone.locator(`[data-proposal-id="${proposal.id}"]`));
        const [decision] = await Promise.all([phone.waitForResponse(response => {
          const responseUrl = new URL(response.url());
          return responseUrl.origin === url.origin && responseUrl.pathname === "/api/sandbox/phone/decision";
        }), expected.getByRole("button", { name: "Approve this booking" }).click()]);
        assert.ok(decision.ok());
      },
      async calendar({ bookingId }) {
        assert.ok(/^[0-9a-f-]{36}$/.test(bookingId));
        await phone.locator("#refresh").click();
        const match = phone.locator(`[data-booking-id="${bookingId}"]`);
        await match.waitFor();
        return { bookings: Array.from({ length: await match.count() }, () => ({ id: bookingId })) };
      },
      async close() { await browser.close(); },
    };
  } catch {
    await browser.close();
    throw Error("SANDBOX_BROWSER_PAIR_FAILED");
  }
}
