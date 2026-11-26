import { expect, test, type Locator, type Page } from "@playwright/test";
import { englishDemoState, salonState } from "./fixtures";

const fixture = englishDemoState("2026-11-17");

// Tall enough that the whole working day and its header fit, since a test drag does not scroll the page.
test.use({ viewport: { width: 1280, height: 1400 } });

test.beforeEach(async ({ context, page }, info) => {
  test.skip(info.project.name !== "desktop", "Dragging is for a mouse; on a phone a booking is moved from its sheet.");
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

/** Starts a drag with the mouse, which Chromium turns into HTML5 drag events. */
async function pickUp(page: Page, source: Locator) {
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + 10, { steps: 4 });
}

async function dropAt(page: Page, point: { x: number; y: number }) {
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.up();
}

/** The middle of a drop target that only exists while a booking is dragged. */
async function centreOf(target: Locator) {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function booking(page: Page, id: string) {
  return (await salonState(page))?.bookings.find(b => b.id === id);
}

test("in the day view a booking dropped on the next or previous day keeps its time", async ({ page }) => {
  await page.goto("/studio/calendar");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Wednesday 18 November" })).toBeVisible();

  // Anna's first visit: Thursday at that time is taken, so the booking stays and the toast says why.
  await pickUp(page, page.getByRole("button", { name: /09:00/ }));
  await dropAt(page, await centreOf(page.getByText("Move to Thursday 19 November")));
  await expect(page.getByText("Thursday 19 November at 09:00 is not free. The booking stayed where it was.")).toBeVisible();
  await expect(page.getByText("Move to Thursday 19 November")).toHaveCount(0);
  expect((await booking(page, "b1723"))?.date).toBe("2026-11-18");

  // Tuesday afternoon is free for Anna.
  const afternoon = page.getByRole("button", { name: /15:15/ });
  await pickUp(page, afternoon);
  await dropAt(page, await centreOf(page.getByText("Move to Tuesday 17 November")));
  await expect(page.getByText("Moved to Tuesday 17 November at 15:15")).toBeVisible();
  await expect(afternoon).toHaveCount(0);
  await expect.poll(async () => (await booking(page, "b1728"))?.date).toBe("2026-11-17");
});

test("the day view offers no day that has already passed", async ({ page }) => {
  await page.goto("/studio/calendar");
  await expect(page.getByRole("heading", { name: "Tuesday 17 November" })).toBeVisible();
  await pickUp(page, page.getByRole("button", { name: /10:00/ }));
  await expect(page.getByText("Move to Wednesday 18 November")).toBeVisible();
  await expect(page.getByText("Move to Monday 16 November")).toHaveCount(0);
  await page.mouse.up();
});

test("in the week view a booking dropped in another day's column moves to that day and time", async ({ page }) => {
  await page.goto("/studio/calendar");
  await page.getByRole("radio", { name: "Week" }).click();
  // Erik's 11:15 on Tuesday, a 30-minute visit; on Thursday Erik is free after lunch until 13:45.
  const customer = fixture.customers.find(c => c.id === fixture.bookings.find(b => b.id === "b1719")!.customerId)!;
  const visit = page.getByRole("button", { name: new RegExp(`^${customer.firstName}\\s*11:15`) });
  const thursday = (await page.getByRole("button", { name: /Thu.*19 Nov/ }).boundingBox())!;
  const from = (await visit.boundingBox())!;
  const pxPerMinute = (from.height + 2) / 30;
  await pickUp(page, visit);
  // Erik is the second of two columns in each day; drop 105 minutes lower than the pick-up point, at 13:00.
  await dropAt(page, { x: thursday.x + thursday.width * 0.75, y: from.y + 4 + 105 * pxPerMinute });
  await expect(page.getByText("Moved to Thursday 19 November at 13:00")).toBeVisible();
  await expect.poll(async () => {
    const moved = await booking(page, "b1719");
    return `${moved?.date} ${moved?.start}`;
  }).toBe("2026-11-19 780");
});

test("in the week view a booking cannot be dropped on a day that has already passed", async ({ page }) => {
  await page.goto("/studio/calendar");
  await page.getByRole("radio", { name: "Week" }).click();
  const customer = fixture.customers.find(c => c.id === fixture.bookings.find(b => b.id === "b1719")!.customerId)!;
  const visit = page.getByRole("button", { name: new RegExp(`^${customer.firstName}\\s*11:15`) });
  const monday = (await page.getByRole("button", { name: /Mon.*16 Nov/ }).boundingBox())!;
  const from = (await visit.boundingBox())!;
  await pickUp(page, visit);
  await dropAt(page, { x: monday.x + monday.width * 0.75, y: from.y + 4 });
  await expect(page.getByText("Moved to Monday 16 November")).toHaveCount(0);
  expect((await booking(page, "b1719"))?.date).toBe("2026-11-17");
});

test("in the week view a drop on a closed day leaves the booking and explains why", async ({ page }) => {
  await page.goto("/studio/calendar");
  await page.getByRole("radio", { name: "Week" }).click();
  const customer = fixture.customers.find(c => c.id === fixture.bookings.find(b => b.id === "b1719")!.customerId)!;
  const visit = page.getByRole("button", { name: new RegExp(`^${customer.firstName}\\s*11:15`) });
  const sunday = (await page.getByRole("button", { name: /Sun.*22 Nov/ }).boundingBox())!;
  const from = (await visit.boundingBox())!;
  await pickUp(page, visit);
  await dropAt(page, { x: sunday.x + sunday.width / 2, y: from.y + 4 });
  await expect(page.getByText("Sunday 22 November at 11:15 is not free. The booking stayed where it was.")).toBeVisible();
  expect((await booking(page, "b1719"))?.date).toBe("2026-11-17");
});

