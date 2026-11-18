import { expect, test, type Page } from "@playwright/test";
import { ASSISTANT } from "../../src/concept/brand";
import { addDays, formatTime } from "../../src/concept/data/dates";
import { createDemoState } from "../../src/concept/data/generate";
import { freeStarts, needOf } from "../../src/concept/data/slots";
import type { DemoState } from "../../src/concept/data/types";
import { salonClock } from "../../src/concept/tools/clock";

// The goal 16 journey, without any AI key: open the assistant, ask about the
// numbers, send an offer, teach it a preference that the next booking uses,
// see the morning brief on Today and switch on a suggested routine.

const today = salonClock().today;
const errors = new WeakMap<Page, string[]>();

async function state(page: Page): Promise<DemoState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
}

async function say(page: Page, text: string) {
  const message = page.getByRole("textbox", { name: "Message" });
  await message.fill(text);
  await message.press("Enter");
}

const panel = (page: Page) => page.getByRole("dialog", { name: ASSISTANT.name });

test.beforeEach(async ({ page }) => {
  // A morning, so Today shows the morning brief rather than the closing one.
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, createDemoState(today));
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", error => messages.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("the assistant answers, drafts an offer, remembers a preference and suggests a routine", async ({ page }) => {
  await page.goto("/studio");
  // No command box on the page: the assistant is one button (and Ctrl/Cmd+K) away.
  await expect(page.getByRole("textbox", { name: "Command box" })).toHaveCount(0);
  // The shortcut works once the studio has hydrated.
  await expect(async () => {
    await page.keyboard.press("Control+K");
    await expect(panel(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();

  // The brief lives on Today; the panel opens at the message box with nothing said for the owner.
  await expect(page.getByRole("heading", { name: "Morning brief" })).toBeVisible();
  await page.getByRole("button", { name: ASSISTANT.name, exact: true }).locator("visible=true").click();
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveAttribute("placeholder", "Who is coming today?");
  await expect(panel(page).getByRole("log").getByText("Morning brief")).toHaveCount(0);

  // A daily question is answered from the data, and its row leads to the customer.
  await say(page, "Who is coming today?");
  await expect(panel(page).getByText(/^\d+ bookings? \w+day \d+ \w+$/).first()).toBeVisible();
  await expect(panel(page).getByRole("log").getByRole("link").first()).toHaveAttribute("href", /\/studio\/customers\//);

  await say(page, "How did last month compare with last year?");
  await expect(panel(page).getByText(/^\w+ \d{4} compared with \w+ \d{4}$/)).toBeVisible();
  await expect(panel(page).getByText(/^[+−]\d+%$/)).toBeVisible();
  await expect(panel(page).getByRole("figure")).toBeVisible();

  const before = await state(page);
  await say(page, "Send an offer to the customers who haven't been here since summer");
  await expect(panel(page).getByText(/^Send an offer to \d+ customers$/)).toBeVisible();
  await panel(page).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(panel(page).getByText("Done", { exact: true })).toBeVisible();
  const sent = await state(page);
  expect(sent.inbox.length).toBeGreaterThan(before.inbox.length + 5);
  expect(sent.log[0]).toMatchObject({ actor: "ai", source: "assistant", type: "customers/message" });

  await say(page, "Remember Lena prefers Erik");
  await panel(page).getByRole("button", { name: "Lena Berg", exact: true }).click();
  await expect.poll(async () => (await state(page)).memory.map(m => m.text)).toEqual(["Lena Berg prefers Erik"]);

  // The next booking for Lena is with Erik, and the card says why.
  const erikFree = (s: DemoState) => {
    const service = s.services.find(x => x.id === "classic-60")!;
    for (let i = 1; i < 30; i++) {
      const date = addDays(today, i);
      const start = freeStarts(s, "erik", date, needOf(service))[0];
      if (start !== undefined) return { date, start };
    }
    throw new Error("Erik has no free time");
  };
  const { date, start } = erikFree(await state(page));
  await say(page, `Book her for classic massage 60 min on ${date} at ${formatTime(start)}`);
  await expect(panel(page).getByText("Understood as: Book Lena Berg for classic massage 60 min", { exact: false })).toBeVisible();
  await expect(panel(page).getByText("Lena Berg prefers Erik").last()).toBeVisible();

  await panel(page).getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/studio/more/memory");
  await expect(page.getByText("Lena Berg prefers Erik")).toBeVisible();

  // Routines are suggested where they are managed, not on Today.
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Morning brief" })).toBeVisible();
  await expect(page.getByText("Prepare Monday reminders for overdue customers")).toHaveCount(0);
  await page.goto("/studio/more/routines");
  await expect(page.getByText("Prepare Monday reminders for overdue customers")).toBeVisible();
  await page.getByRole("button", { name: "Switch on", exact: true }).first().click();
  await expect.poll(async () => (await state(page)).routines.map(r => [r.id, r.enabled])).toEqual([["monday-reminders", true]]);
  await expect(page.getByRole("switch", { name: "Prepare Monday reminders for overdue customers" })).toBeChecked();
});

test("the microphone inside the panel sends what was said", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((event: unknown) => void) | null = null; onerror = null; onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: "Who is coming tomorrow?" } } } });
          this.onend?.();
        }, 50);
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await page.goto("/studio");
  // One quiet launcher on phones: the microphone is in the panel, not beside it.
  await expect(page.getByRole("button", { name: "Talk to the assistant" })).toHaveCount(0);
  await expect(async () => {
    await page.keyboard.press("Control+K");
    await expect(panel(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await panel(page).getByRole("button", { name: "Speak a command", exact: true }).click();
  await expect(panel(page).getByText(/bookings? \w+day \d+ \w+/).first()).toBeVisible();
});
