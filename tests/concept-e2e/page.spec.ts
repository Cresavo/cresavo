import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { BRAND } from "../../src/concept/brand";
import { createDemoState } from "../../src/concept/data/generate";
import type { DemoState } from "../../src/concept/data/types";
import { salonClock } from "../../src/concept/tools/clock";

// The goal 17 journey: pick an address, see subdomains resolve, start an own
// domain, design the booking page with a live preview, ask the assistant for a
// calmer look, prove custom CSS cannot run script, and check accessibility.

const today = salonClock().today;
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const errors = new WeakMap<Page, string[]>();

const state = (page: Page): Promise<DemoState> => page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
const phone = (page: Page) => page.viewportSize()!.width < 640;
const frame = (page: Page) => page.frameLocator("iframe[title^='Preview of your booking page']");
const screenshot = async (page: Page, name: string, height = 1800) => {
  if (process.env.CONCEPT_SCREENSHOTS !== "1") return;
  await page.evaluate(() => window.scrollTo(0, 0));
  const { width } = page.viewportSize()!;
  await page.screenshot({ animations: "disabled", path: `docs/concept/screens/page-${name}-${width}.png`, fullPage: true, clip: { x: 0, y: 0, width, height } });
};

async function violations(page: Page) {
  await page.addScriptTag({ path: AXE });
  const result = await page.evaluate(() => (window as unknown as { axe: { run: () => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run());
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, createDemoState(today));
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("pick an address, resolve it by host and start an own domain", async ({ page, request }) => {
  await page.goto("/studio/more/settings");
  const slug = page.getByLabel("Your name in the address");
  await slug.fill("admin");
  await expect(page.getByText("That name is kept for the system. Choose another.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save address" })).toBeDisabled();
  await slug.fill("klippet");
  await expect(page.getByText("Someone already uses that name. Choose another.")).toBeVisible();
  await slug.fill("kajsa-fotvard");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Your booking page is now at kajsa-fotvard.localhost")).toBeVisible();
  expect((await state(page)).salon.slug).toBe("kajsa-fotvard");

  await page.goto("/boka/kajsa-fotvard");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "No booking page here" })).toBeVisible();

  // A business's own address is resolved by the proxy: the subdomain serves its booking page and nothing else.
  await page.goto("/studio/more/settings");
  await slug.fill("salong-eko");
  await page.getByRole("button", { name: "Save address" }).click();
  await page.goto("http://salong-eko.localhost:3017/");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  await page.goto("http://salong-eko.localhost:3017/studio");
  await expect(page.getByRole("heading", { name: "No booking page here" })).toBeVisible();
  const unknown = await request.get("/", { headers: { host: "nobody.example.org" } });
  expect(await unknown.text()).toContain("No booking page here");
  expect(await unknown.text()).toContain("nobody.example.org");

  await page.goto("/studio/more/settings");
  await expect(page.getByText("Use your own web address, such as boka.yourname.se")).toBeVisible();
  await page.goto("/studio/more/features");
  await page.getByRole("switch", { name: "Own domain" }).click();
  await page.goto("/studio/more/settings");
  const domain = page.getByLabel("Your web address");
  await domain.fill("salongeko.se");
  await expect(page.getByText("Use a subdomain such as boka.yourname.se.")).toBeVisible();
  await domain.fill("https://Boka.SalongEko.se/");
  await page.getByRole("button", { name: "Connect domain" }).click();
  await expect(page.getByText("boka.salongeko.se", { exact: true })).toBeVisible();
  await expect(page.getByText("cname.vercel-dns.com", { exact: true })).toBeVisible();
  await expect(page.getByText("CNAME", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for DNS", { exact: true })).toBeVisible();
  await screenshot(page, "domain");
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("Verifying", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("Secure and live", { exact: true })).toBeVisible();
  await expect(page.getByText("Your booking page is live at https://boka.salongeko.se.")).toBeVisible();
  expect((await state(page)).domain).toEqual({ host: "boka.salongeko.se", status: "secure" });
});

test("design the booking page with a live preview, and custom CSS cannot run script", async ({ page }) => {
  await page.goto("/studio/more/booking-page");
  if (phone(page)) await expect(page.getByRole("radio", { name: "Edit" })).toBeChecked();
  await page.getByRole("button", { name: "Night and gold" }).click();
  await page.getByRole("button", { name: "Elegant" }).click();
  await page.getByRole("radio", { name: "Sharp" }).click();
  await page.getByRole("button", { name: "Move Reviews up" }).click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("radio", { name: "One quote" }).click();
  await expect(page.getByText("Readable: every text and button colour passes WCAG AA.")).toBeVisible();
  await expect(page.getByText("You have changes that customers cannot see yet.")).toBeVisible();
  expect((await state(page)).page.theme.colors).toBeNull();

  const css = "h1 { letter-spacing: 0.1em; background: url(https://evil.example/x.png) }\n</style><script>window.__pwned = 1</script>\n@import url(https://evil.example/x.css);";
  await page.getByRole("textbox", { name: "Your own CSS" }).fill(css);
  await expect(page.getByText("1 rule applied")).toBeVisible();
  if (phone(page)) await page.getByRole("radio", { name: "Preview" }).click();
  const preview = frame(page);
  await expect(preview.locator(".booking-theme")).toHaveAttribute("data-corners", "sharp");
  await expect(preview.getByRole("heading", { name: "What customers say" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Good to know" })).toBeVisible();
  expect(await preview.locator(".booking-theme").evaluate((el) => getComputedStyle(el).getPropertyValue("--eko-bg").trim())).toBe("23 24 26");
  expect(await preview.locator("h1").first().evaluate((el) => getComputedStyle(el).letterSpacing)).not.toBe("normal");
  await screenshot(page, "editor");
  if (phone(page)) await page.getByRole("radio", { name: "Edit" }).click();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Booking page updated").first()).toBeVisible();
  const saved = (await state(page)).page;
  expect(saved.theme).toMatchObject({ fonts: "elegant", corners: "sharp", colors: { background: "#17181a" } });
  expect(saved.sections.map((s) => s.kind).slice(0, 3)).toEqual(["hero", "treatments", "reviews"]);

  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  await expect(page.locator(".booking-theme")).toHaveAttribute("data-corners", "sharp");
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator("style").evaluateAll((nodes) => nodes.map((n) => n.textContent ?? "").join("\n"))).not.toMatch(/evil|<script|@import/);
  expect(await page.evaluate(() => [...document.scripts].some((s) => s.textContent?.includes("__pwned")))).toBe(false);
  expect(await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).letterSpacing)).not.toBe("normal");
  await expect(page.locator("[data-booking-flow]")).toBeVisible();
  await screenshot(page, "themed", 1050);
  expect(await violations(page)).toEqual([]);
});

test("the default booking page has no accessibility violations", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.goto("/unknown-address");
  expect(await violations(page)).toEqual([]);
});

test("a custom theme with other sections has no accessibility violations", async ({ page }) => {
  await page.goto("/studio/more/booking-page");
  await page.getByRole("button", { name: "Warm rose" }).click();
  await page.getByRole("radio", { name: "Round" }).click();
  for (const name of ["Team", "Gallery", "Questions"]) await page.getByRole("button", { name: new RegExp(`^${name}$`) }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Meet the team" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("the assistant proposes a calmer look with a before and after, and approving applies it", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: `Ask ${BRAND.name}`, exact: true }).locator("visible=true").click();
  const panel = page.getByRole("dialog", { name: `Ask ${BRAND.name}` });
  const message = panel.getByRole("textbox", { name: "Message" });
  await message.fill("Make it calmer and more luxurious");
  await message.press("Enter");
  await expect(panel.getByText("Change the look of your booking page")).toBeVisible();
  await expect(panel.getByRole("group", { name: "Booking page before and after" })).toBeVisible();
  await expect(panel.getByText("Calm sand")).toBeVisible();
  expect((await state(page)).page.theme.colors).toBeNull();
  await screenshot(page, "assistant", 900);
  await panel.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(panel.getByText("Done", { exact: true })).toBeVisible();
  const after = await state(page);
  expect(after.page.theme).toMatchObject({ fonts: "elegant", colors: { background: "#f6f1e9" } });
  expect(after.log[0]).toMatchObject({ actor: "ai", source: "assistant", type: "page/set" });

  await page.goto("/boka/salong-eko");
  expect(await page.locator(".booking-theme").evaluate((el) => getComputedStyle(el).getPropertyValue("--eko-bg").trim())).toBe("246 241 233");
});
