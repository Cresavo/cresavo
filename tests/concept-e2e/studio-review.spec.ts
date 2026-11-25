import { expect, test, type Page } from "@playwright/test";
import { englishDemoState, fixtureText } from "./fixtures";

// The November review pass: the calendar toolbar beside a docked booking, the phone chrome with large text and
// a customer card that wraps instead of clipping.
const today = "2026-11-17";
const fixture = englishDemoState(today);
const copy = fixtureText(fixture);

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;
const largeText = (page: Page) => page.addStyleTag({ content: "html { font-size: 200% !important; }" });

test("a booking docked beside the week leaves Day and Week readable and puts the staff filter in the options", async ({ page }) => {
  test.skip(isPhone(page), "The panel docks on wide screens only.");
  await page.goto("/studio/calendar");
  const view = page.getByRole("radiogroup", { name: copy("calendar.view") });
  await view.getByRole("radio", { name: copy("calendar.week") }).click();
  const staff = page.getByRole("radiogroup", { name: copy("calendar.staff") });
  await expect(staff).toBeVisible();

  await page.locator("[data-calendar-booking]").first().click();
  await expect(page.locator(".ui-sheet[data-docked][open]")).toBeVisible();
  await expect(staff).toBeHidden();
  const week = view.getByRole("radio", { name: copy("calendar.week") });
  await expect(week).toBeInViewport({ ratio: 1 });
  const [track, chosen] = await Promise.all([view.boundingBox(), week.boundingBox()]);
  expect(chosen!.x + chosen!.width).toBeLessThanOrEqual(track!.x + track!.width + 1);

  await page.getByRole("button", { name: copy("calendar.options") }).click();
  await expect(page.getByRole("radiogroup", { name: copy("calendar.staff") })).toBeVisible();
});

test("with large text the phone tab bar holds its icons without an empty band, and the theme thumb stays under its icon", async ({ page }) => {
  test.skip(!isPhone(page), "The tab bar is the phone's navigation.");
  await page.goto("/studio");
  await largeText(page);
  const bar = page.getByRole("navigation", { name: copy("shell.navigation") }).locator("visible=true");
  const tab = bar.getByRole("link", { name: copy("nav.today") });
  const [barBox, iconBox] = await Promise.all([bar.boundingBox(), tab.locator(".studio-tab-icon").boundingBox()]);
  expect(barBox!.y + barBox!.height - (iconBox!.y + iconBox!.height)).toBeLessThanOrEqual(24);

  const toggle = page.getByRole("switch", { name: copy("theme.darkSwitch") }).locator("visible=true").first();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const parts = toggle.locator("span > span");
  // The thumb slides; wait for it to settle under the moon.
  await expect.poll(async () => {
    const [thumb, moon] = await Promise.all([parts.first().boundingBox(), parts.last().boundingBox()]);
    return Math.abs(thumb!.x - moon!.x);
  }).toBeLessThanOrEqual(2);
});

test("the customer card wraps a long name with large text instead of cutting it off", async ({ page }) => {
  const customer = fixture.customers[0];
  await page.goto(`/studio/customers/${customer.id}`);
  await largeText(page);
  const name = page.getByText(`${customer.firstName} ${customer.lastName}`, { exact: true }).nth(1);
  await expect(name).toBeVisible();
  expect(await name.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
