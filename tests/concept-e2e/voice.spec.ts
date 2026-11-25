import { expect, test, type Page } from "@playwright/test";
import { ASSISTANT } from "../../src/concept/brand";
import { addDays, formatTime } from "../../src/concept/data/dates";
import { createDemoState } from "../../src/concept/data/generate";
import { freeStarts } from "../../src/concept/data/slots";
import type { DemoState } from "../../src/concept/data/types";
import { fullName } from "../../src/concept/selectors";
import { salonState } from "./fixtures";

// The spoken conversation lab with the browser's speech features replaced by
// fakes: no microphone, no audio. The Labs switch turns it on; the microphone
// then listens, reads a safe line aloud and listens again; Stop ends it; and a
// spoken move is only a proposal until Approve is tapped.

const today = "2026-11-17";
const initial = createDemoState(today);
const panel = (page: Page) => page.getByRole("dialog", { name: ASSISTANT.name });

/** A booking whose customer has no other booking that day, and a free time for it later that week. */
function movable(state: DemoState) {
  for (const booking of state.bookings) {
    if (booking.status !== "booked" || booking.date <= today) continue;
    const customer = state.customers.find((c) => c.id === booking.customerId)!;
    if (state.customers.filter((c) => fullName(c) === fullName(customer)).length > 1) continue;
    if (state.bookings.some((o) => o.id !== booking.id && o.customerId === booking.customerId && o.date === booking.date)) continue;
    for (let i = 1; i < 10; i++) {
      const date = addDays(booking.date, i);
      const start = freeStarts(state, booking.staffId, date, booking, { ignoreId: booking.id })[0];
      if (start !== undefined) return { booking, customer, date, start };
    }
  }
  throw new Error("no movable booking in the demo data");
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript((seed) => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(seed));
    const voice = { recognisers: [] as FakeRecognition[], spoken: [] as string[] };
    (window as unknown as { voice: typeof voice }).voice = voice;
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false; local = false;
      // As in Chrome, the on-device choice is an attribute of the prototype.
      get processLocally() { return this.local; }
      set processLocally(value: boolean) { this.local = value; }
      static available() { return Promise.resolve("available"); }
      onresult: ((event: unknown) => void) | null = null; onerror: ((event: { error: string }) => void) | null = null; onend: (() => void) | null = null;
      start() { voice.recognisers.push(this); }
      stop() { this.onend?.(); }
      abort() { this.onerror?.({ error: "aborted" }); this.onend?.(); }
      say(transcript: string) {
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript } } } });
        this.onend?.();
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    class Utterance {
      lang = ""; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    let current: Utterance | null = null;
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utterance;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        // A line is "said" when the test says so, so the reading state can be seen.
        speak(utterance: Utterance) { current = utterance; voice.spoken.push(utterance.text); },
        cancel() { const cut = current; current = null; cut?.onerror?.(); },
        finish() { const done = current; current = null; done?.onend?.(); },
      },
    });
  }, initial);
});

/** The words the fake microphone hears next. */
async function hear(page: Page, words: string) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { voice: { recognisers: unknown[] } }).voice.recognisers.length)).toBeGreaterThan(0);
  await page.evaluate((text) => (window as unknown as { voice: { recognisers: { say(t: string): void }[] } }).voice.recognisers.at(-1)!.say(text), words);
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { voice: { spoken: string[] } }).voice.spoken);

test("the Labs switch on Advanced is off until switched on, and kept in this browser", async ({ page }) => {
  await page.goto("/studio/more/advanced");
  const labs = page.getByRole("switch", { name: "Talk with the assistant" });
  await expect(labs).toHaveAttribute("aria-checked", "false");
  await labs.click();
  await expect(labs).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("This browser recognises speech on the device.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("salong-eko-labs"))).toBe(JSON.stringify({ voiceAssistant: true }));
  await page.reload();
  await expect(page.getByRole("switch", { name: "Talk with the assistant" })).toHaveAttribute("aria-checked", "true");
});

test("without the switch the panel keeps its one-phrase microphone", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: ASSISTANT.name, exact: true }).locator("visible=true").click();
  await expect(panel(page).getByRole("button", { name: "Speak a command", exact: true })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Start talking" })).toHaveCount(0);
});

test("a spoken conversation listens, reads a safe line, listens again, and only proposes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("salong-eko-labs", JSON.stringify({ voiceAssistant: true })));
  const { booking, customer, date, start } = movable(initial);
  await page.goto("/studio");
  await page.getByRole("button", { name: ASSISTANT.name, exact: true }).locator("visible=true").click();
  await expect(panel(page).getByRole("button", { name: "Speak a command" })).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Start talking", exact: true }).click();
  await expect(panel(page).getByRole("status").filter({ hasText: "Listening" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Stop talking", exact: true }).first()).toBeVisible();

  await hear(page, `Move ${fullName(customer)} on ${booking.date} to ${date} at ${formatTime(start)}`);
  const approve = panel(page).getByRole("button", { name: "Approve", exact: true });
  await expect(approve).toBeVisible();
  await expect(panel(page).getByRole("status").filter({ hasText: "Reading the reply aloud" })).toBeVisible();
  const said = (await spoken(page)).at(-1)!;
  expect(said).toContain("Approve it on the screen");
  expect(said).toContain(customer.firstName);
  expect(said).not.toContain(customer.lastName);
  // Nothing has changed: the proposal waits for a tap.
  expect((await salonState(page))!.bookings.find((b) => b.id === booking.id)).toMatchObject({ date: booking.date, start: booking.start });

  // When the line is said, it listens again; "yes" approves nothing.
  await page.evaluate(() => (window.speechSynthesis as unknown as { finish(): void }).finish());
  await expect(panel(page).getByRole("status").filter({ hasText: "Listening" })).toBeVisible();
  await hear(page, "yes");
  await expect(panel(page).getByRole("status").filter({ hasText: /Listening|Reading the reply aloud/ })).toBeVisible();
  expect((await salonState(page))!.bookings.find((b) => b.id === booking.id)).toMatchObject({ date: booking.date, start: booking.start });
  await expect(approve).toBeVisible();

  // Stop ends it; the tap approves.
  await panel(page).getByRole("button", { name: "Stop talking", exact: true }).first().click();
  await expect(panel(page).getByRole("status").filter({ hasText: "Stopped talking." })).toBeVisible();
  await approve.click();
  await expect.poll(async () => (await salonState(page))!.bookings.find((b) => b.id === booking.id)).toMatchObject({ date, start });
});
