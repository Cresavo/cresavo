import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { DEFAULT_LIMITS } from "../../src/concept/receptionist/limits";
import { salonState } from "../concept-e2e/fixtures";
import { authorization, callsTool, greeting, hears, installFakeRealtime, says } from "./fake-realtime";

// The owner's journey from the goal: switch the phone receptionist on, press
// "Try in the browser", talk to Maja and see the booking in the calendar. The
// model is scripted; the engine, the booking rules and the page are real.

const today = "2026-11-17";
const text = (key: MessageKey, vars?: Record<string, string | number>) => translate("en", key, vars);
const SECRET = "ek_fictional_client_secret";

async function open(page: Page, configured = true) {
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript((seed) => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(seed));
  }, createDemoState(today));
  await installFakeRealtime(page);
  await page.route("**/api/concept/receptionist", (route) => route.fulfill({ json: { enabled: true, configured, limits: DEFAULT_LIMITS, model: "gpt-realtime-mini" } }));
  await page.route("**/api/concept/receptionist/session", (route) =>
    route.fulfill({ json: { callId: "call-e2e-0001", clientSecret: SECRET, expiresAt: 1_900_000_000, model: "gpt-realtime-mini", limits: DEFAULT_LIMITS } }));
  await page.goto("/studio/more/receptionist");
  await expect(page.getByRole("heading", { name: text("nav.receptionist"), level: 1 })).toBeVisible();
}

test("the studio may use the microphone and reach the voice service only because the switch is on", async ({ page }) => {
  const response = await page.goto("/studio/more/receptionist");
  expect(response!.headers()["permissions-policy"]).toContain("microphone=(self)");
  expect(response!.headers()["content-security-policy"]).toContain("connect-src 'self' https://api.openai.com");
  const booking = await page.goto("/boka/salong-eko");
  expect(booking!.headers()["permissions-policy"]).toContain("microphone=()");
  expect(booking!.headers()["content-security-policy"]).not.toContain("api.openai.com");
});

test("More lists the phone receptionist for the sample salon", async ({ page }) => {
  await open(page);
  await page.goto("/studio/more");
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(text("nav.receptionist")) })).toBeVisible();
});

test("a test call needs Maja switched on and the voice service connected", async ({ page }) => {
  await open(page, false);
  await expect(page.getByText(text("receptionist.test.switchOn"))).toBeVisible();
  await page.getByRole("switch", { name: text("receptionist.enabled.label") }).click();
  await expect(page.getByText(text("receptionist.problem.not-configured.what"))).toBeVisible();
  await expect(page.getByRole("button", { name: text("receptionist.test.start") })).toHaveCount(0);
});

test("switch on, set the greeting, try a call: an off-topic question, then a booking that shows in the calendar", async ({ page }) => {
  await open(page);
  await page.getByRole("switch", { name: text("receptionist.enabled.label") }).click();
  await page.getByLabel(text("receptionist.greeting.label")).fill("Salong Eko, det är Maja. Hur kan jag hjälpa dig?");
  await page.getByLabel(text("receptionist.greeting.label")).blur();
  await page.getByRole("radio", { name: text("receptionist.answerWhen.closed") }).click();
  await expect(page.getByText(text("receptionist.answerWhen.now.no"))).toBeVisible();
  expect((await salonState(page))!.receptionist).toEqual({ enabled: true, greeting: "Salong Eko, det är Maja. Hur kan jag hjälpa dig?", answerWhen: "closed" });

  await page.getByRole("button", { name: text("receptionist.test.start") }).click();
  await expect(page.getByText(text("receptionist.test.live"))).toBeVisible();
  // The browser connected with the one-minute secret, and greets with the owner's words.
  expect(await authorization(page)).toBe(`Bearer ${SECRET}`);
  expect(await greeting(page)).toContain("Salong Eko, det är Maja. Hur kan jag hjälpa dig?");
  await says(page, "Salong Eko, det är Maja. Hur kan jag hjälpa dig?");

  // Something that is not about the salon.
  await hears(page, "Vad blir det för väder i morgon?");
  await says(page, "Det kan jag tyvärr inte svara på, men jag hjälper gärna till med en tid hos oss.");
  await hears(page, "Okej, då vill jag boka en klippning.");

  const info = await callsTool(page, "get_salon_info", {});
  const treatment = (info.treatments as { id: string; name: string }[])[0];
  const days = (info.openingHours as { date: string; open: string }[]).filter((day) => day.open !== "closed" && day.date > today);
  let slot: { time: string; staffId: string; staff: string } | undefined;
  let date = "";
  for (const day of days) {
    const free = await callsTool(page, "find_free_times", { serviceId: treatment.id, date: day.date });
    slot = (free.times as { time: string; staffId: string; staff: string }[])[0];
    date = day.date;
    if (slot) break;
  }
  expect(slot).toBeDefined();
  const details = { serviceId: treatment.id, staffId: slot!.staffId, date, time: slot!.time, callerName: "Robin Vale", callerPhone: "070-174 06 42" };

  // Even if the model claims the caller confirmed, the first call only reads the details back.
  const before = (await salonState(page))!.bookings.length;
  expect(await callsTool(page, "book_appointment", { ...details, confirmed: true })).toMatchObject({ status: "needs_confirmation", readBack: { name: "Robin Vale", time: slot!.time } });
  expect((await salonState(page))!.bookings).toHaveLength(before);
  await says(page, `Då blir det ${treatment.name} klockan ${slot!.time} hos ${slot!.staff}, för Robin Vale. Stämmer det?`);
  await hears(page, "Ja, det stämmer.");
  expect(await callsTool(page, "book_appointment", { ...details, confirmed: true })).toMatchObject({ status: "booked" });
  await says(page, "Då är det bokat. Ha en fin dag!");
  await expect(page.getByRole("log").getByText("Ja, det stämmer.")).toBeVisible();

  await callsTool(page, "end_call", {});
  await expect(page.getByText(text("receptionist.test.ended.booked"))).toBeVisible();

  const saved = (await salonState(page))!;
  const booking = saved.bookings.find((b) => b.id === saved.receptionistCalls![0].bookingId)!;
  expect(booking).toMatchObject({ serviceId: treatment.id, staffId: slot!.staffId, date, source: "phone", status: "booked" });
  expect(saved.receptionistCalls![0]).toMatchObject({ id: "call-e2e-0001", channel: "browser-test", outcome: "booked", endedBy: "receptionist" });
  expect(saved.receptionistCalls![0].transcript.map((line) => line.who)).toEqual(["receptionist", "caller", "receptionist", "caller", "receptionist", "caller", "receptionist"]);

  // The call is in the list with its booking and transcript.
  const row = page.locator("details").first();
  await expect(row).toContainText(text("receptionist.calls.outcome.booked"));
  await expect(row).toContainText(treatment.name);
  await row.locator("summary").click();
  await expect(row.getByText("Vad blir det för väder i morgon?")).toBeVisible();

  // And the booking is in the calendar.
  await row.getByRole("link", { name: text("receptionist.calls.openBooking") }).click();
  await expect(page).toHaveURL(/\/studio\/calendar\?booking=/);
  await expect(page.getByText("Robin Vale").first()).toBeVisible();
});

test("the person at the screen can end the call, and it is still saved", async ({ page }) => {
  await open(page);
  await page.getByRole("switch", { name: text("receptionist.enabled.label") }).click();
  await page.getByRole("button", { name: text("receptionist.test.start") }).click();
  await greeting(page);
  await says(page, "Hej och välkommen till Salong Eko.");
  await page.getByRole("button", { name: text("receptionist.test.hangUp") }).click();
  await expect(page.getByText(text("receptionist.test.ended.none"))).toBeVisible();
  expect((await salonState(page))!.receptionistCalls![0]).toMatchObject({ outcome: "none", endedBy: "caller" });
  await expect(page.getByRole("button", { name: text("receptionist.test.again") })).toBeVisible();
});
