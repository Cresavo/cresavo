import { expect, test } from "@playwright/test";

// "Show me" in Help: the guide walks to Move on a booking, takes the steps that only open things, and leaves the
// button that changes data for the owner to press. Keyboard only after the question.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T11:00:00+01:00"));
  await page.addInitScript(() => localStorage.setItem("studio-tour-seen-v1", "1"));
});

test("Show me points the way to Move and leaves pressing it to the owner", async ({ page }) => {
  await page.goto("/studio");
  await page.locator('[data-help-id="shell.help"]:visible').first().click();
  const question = page.getByLabel("What do you want to do?");
  await question.fill("how do I reschedule a booking");
  await question.press("Enter");
  await page.getByRole("button", { name: /^Show me: Move a booking/ }).click();

  const card = page.locator(".studio-show-me-card");
  await expect(card.getByRole("heading", { name: "Calendar" })).toBeFocused();
  await expect(page.locator('[data-tour-active][data-help-id="nav.calendar"]:visible')).toHaveCount(1);
  await card.getByRole("button", { name: "Take me there" }).click();
  await expect(page).toHaveURL(/\/studio\/calendar$/);

  await expect(card.getByRole("heading", { name: "A booking" })).toBeFocused();
  await card.getByRole("button", { name: "Take me there" }).click();

  const move = page.locator('[data-help-id="booking.move"]');
  await expect(card.getByRole("heading", { name: "Move a booking" })).toBeVisible();
  await expect(move).toHaveAttribute("data-tour-active", "");
  await expect(card.getByText("Press it yourself when you are ready.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Take me there" })).toHaveCount(0);
  // Nothing moved: the move times only open when the owner presses Move.
  await expect(page.getByRole("button", { name: "Move booking", exact: true })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(move).toBeFocused();
  await expect(move).not.toHaveAttribute("data-tour-active", "");
});

test("a question Show me does not know gets common places instead", async ({ page }) => {
  await page.goto("/studio");
  await page.locator('[data-help-id="shell.help"]:visible').first().click();
  const question = page.getByLabel("What do you want to do?");
  await question.fill("where is the pizza oven");
  await question.press("Enter");
  await expect(page.getByText("I could not find that in the studio.")).toBeVisible();
  await page.getByRole("button", { name: "Change opening hours" }).click();
  await expect(page.locator(".studio-show-me-card")).toBeVisible();
});

test("a guide through Help opens History and its Trash even after an earlier answer", async ({ page }) => {
  await page.goto("/studio");
  await page.locator('[data-help-id="shell.help"]:visible').first().click();
  const question = page.getByLabel("What do you want to do?");
  await question.fill("get back a deleted customer");
  await question.press("Enter");
  // The articles' answer replaces Help's landing view, where History lives.
  await expect(page.getByText("Looking it up…")).toHaveCount(0);
  await page.getByRole("button", { name: /^Show me: Trash/ }).click();

  const card = page.locator(".studio-show-me-card");
  await expect(card.getByRole("heading", { name: "Help" })).toBeFocused();
  await card.getByRole("button", { name: "Take me there" }).click();
  // Help opened again on its landing view, so the History row is there to point at and press.
  await expect(card.getByRole("heading", { name: "History and undo" })).toBeFocused();
  await expect(page.locator('button[data-help-id="help.history"][data-tour-active]')).toBeVisible();
  await card.getByRole("button", { name: "Take me there" }).click();
  await expect(page).toHaveURL(/\/studio\/more\/log$/);
  await expect(card.getByRole("heading", { name: "Trash" })).toBeVisible();
  await expect(page.locator('[data-help-id="log.trash"][data-tour-active]')).toBeVisible();
});
