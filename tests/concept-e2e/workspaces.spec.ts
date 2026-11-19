import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";
import { salonClock } from "../../src/concept/tools/clock";

const today = salonClock().today;

async function seed(page: Page, people = ["Lo Demo"], currency = "SEK") {
  const demo = createDemoState(today);
  const own = createSalon(today, { ...salonDraft("en"), name: "Studio Vide", people, currency });
  await page.addInitScript(({ demo, own }) => {
    if (localStorage.getItem("salong-eko-demo")) return;
    localStorage.setItem("salong-eko-demo", JSON.stringify(demo));
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(own));
    localStorage.setItem("studio-tour-seen-v1", "1");
  }, { demo, own });
  await page.goto("/boka/studio-vide");
  await expect(page.getByRole("link", { name: "Studio Vide", exact: true })).toBeVisible();
}

test("a demo booking tab leaves the open salon hours form and its save in the owner tab", async ({ page, context }) => {
  await seed(page);
  await page.goto("/studio/more/settings");
  await page.locator("#hours").getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Opening hours" });
  await dialog.getByLabel("Monday from").selectOption("630");
  const other = await context.newPage();
  await other.goto("/boka/salong-eko");
  await expect(other.getByRole("link", { name: "Salong Eko", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Monday from")).toHaveValue("630");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#hours")).toContainText("10:30");
  await page.reload();
  await expect(page.locator("#hours")).toContainText("10:30");
  const opens = await page.evaluate(() => ["salong-eko-demo", "salong-eko-demo-own"].map(key =>
    JSON.parse(localStorage.getItem(key)!).salon.hours[1].open));
  expect(opens[0]).toBe(createDemoState(today).salon.hours[1]!.open);
  expect(opens[1]).toBe(630);
});

test("a renamed demo address is unavailable in setup and both salons reserve each other's address in Settings", async ({ page }) => {
  await page.goto("/studio/more/settings");
  const address = page.getByLabel("Your name in the address");
  const save = page.getByRole("button", { name: "Save address" });
  await address.fill("studio-fern");
  await save.click();
  await expect(save).toBeDisabled();
  await page.goto("/studio/setup");
  await page.getByLabel("Name", { exact: true }).fill("Studio Vide");
  for (let step = 0; step < 5; step++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await address.fill("studio-fern");
  await expect(page.getByRole("button", { name: "Create booking page" })).toBeDisabled();
  await address.fill("studio-vide");
  await page.getByRole("button", { name: "Create booking page" }).click();
  await expect(page.getByRole("link", { name: "/boka/studio-vide" })).toBeVisible();
  await page.goto("/studio/more/settings");
  await address.fill("studio-fern");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Back to the demo salon" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await page.goto("/studio/more/settings");
  await address.fill("studio-vide");
  await expect(save).toBeDisabled();
});

for (const role of ["owner", "staff"] as const) {
  test(`the ${role} can book the first team visit onto the colleague's calendar`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-23T08:00:00+01:00"));
    await seed(page, ["Lo Demo", "Kim Demo"]);
    await page.goto("/studio/calendar");
    if (role === "staff") await page.locator('[data-help="role-switch"]:visible').click();
    await page.getByRole("button", { name: "New booking", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "New booking" });
    const assignee = sheet.getByRole("combobox", { name: "Staff", exact: true });
    if (role === "owner") await assignee.selectOption({ label: "Kim Demo" });
    else await expect(assignee).toHaveCount(0);
    await sheet.getByRole("button", { name: /Add new (client|customer)/i }).click();
    await sheet.getByLabel(/(Client|Customer) name/i).fill("Nova Demo");
    await sheet.getByLabel("Phone number").fill("0700009911");
    await sheet.getByRole("button", { name: "09:00", exact: true }).click();
    await sheet.getByRole("button", { name: "Book 09:00", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    const bookings = await page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo-own")!).bookings);
    expect(bookings).toMatchObject([{ staffId: "staff-2" }]);
  });
}

test("opening a solo salon booking link from demo staff view restores owner access", async ({ page }) => {
  await seed(page);
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("link", { name: "Salong Eko", exact: true })).toBeVisible();
  await page.goto("/studio/calendar");
  await page.locator('[data-help="role-switch"]:visible').click();
  await page.goto("/boka/studio-vide");
  await page.getByRole("link", { name: "Open the owner's view" }).click();
  await expect(page.getByRole("button", { name: "Back to the demo salon" })).toBeVisible();
  await page.goto("/studio/more/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("a configured AI server receives no local customer summary after switching back to the demo", async ({ page }) => {
  await seed(page);
  const customer = { ...createDemoState(today).customers[0], firstName: "Nova", lastName: "Demo", note: "Fictional local note" };
  await page.evaluate(customer => {
    const own = JSON.parse(localStorage.getItem("salong-eko-demo-own")!);
    own.customers = [customer];
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(own));
  }, customer);

  let release!: () => void;
  const configured = new Promise<void>(resolve => { release = resolve; });
  const summaries: string[] = [];
  await page.route("**/api/concept/ai", async route => {
    await configured;
    await route.fulfill({ json: { configured: true } });
  });
  await page.route("**/api/concept/ai/*", async route => {
    if (route.request().url().endsWith("/summarize-customer")) summaries.push(route.request().postData() ?? "");
    await route.fulfill({ status: 403 });
  });
  await page.goto(`/studio/customers/${customer.id}`);
  await expect(page.getByRole("heading", { name: "Nova Demo" })).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page.getByRole("button", { name: "Back to the demo salon" }).click();
  await expect(page.getByRole("button", { name: "Open your salon" })).toBeVisible();
  release();
  await page.waitForLoadState("networkidle");
  expect(summaries).toEqual([]);
});

test("local AI settings show browser rules without contacting the server AI settings", async ({ page }) => {
  await seed(page);
  const requests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/concept/ai")) requests.push(request.url()); });
  await page.goto("/studio/more/data");
  await expect(page.getByText("This salon uses built-in rules in your browser.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your own AI key" })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("the first cost uses the salon currency and campaign copy and poster use its booking URL", async ({ page }) => {
  await seed(page, ["Lo Demo"], "EUR");
  await page.goto("/studio/more/finance");
  await page.getByRole("button", { name: "Add a monthly cost" }).click();
  await page.getByLabel("Per month (EUR)").fill("75");
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  await expect(page.getByText("€75", { exact: true }).first()).toBeVisible();
  await page.goto("/studio/more/campaigns");
  await page.getByRole("link", { name: "New campaign" }).click();
  await page.getByRole("button", { name: "Write the texts" }).click();
  const destination = new URL("/boka/studio-vide?campaign=", page.url()).href;
  await expect.poll(() => page.locator("#copy-sms").inputValue()).toContain(destination);
  await page.getByRole("button", { name: "Make the poster" }).click();
  await expect(page.locator("svg[role=img]").last()).toContainText("/boka/studio-vide");
});
