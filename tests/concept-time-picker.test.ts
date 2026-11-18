import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { openSlots } from "@/concept/booking/suggest";
import { TimePicker } from "@/concept/booking/time-picker";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";

const clock = { today: "2026-11-16", minutes: 480 };
const base = createDemoState(clock.today);
const serviceId = base.services[0].id;

it.each([
  ["every weekday is closed", { hours: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } }],
  ["every date in the window has a closure", {
    closures: Array.from({ length: 28 }, (_, i) => ({ id: `closure-${i}`, date: addDays(clock.today, i), name: "Closed" })),
  }],
])("shows the salon's contact links when %s", (_label, changes) => {
  const state = { ...base, salon: { ...base.salon, ...changes, phone: "+46 70 123 45 67", email: "salon@example.test" } };
  expect(openSlots(state, serviceId, clock.today, clock)).toEqual([]);
  const html = renderToStaticMarkup(createElement(TimePicker, {
    state, serviceId, clock, onPick: () => {}, onWaitlist: () => {},
  }));
  expect(html).toContain("No free times in the next four weeks");
  expect(html).toContain('href="tel:+46701234567"');
  expect(html).toContain('href="mailto:salon@example.test"');
});
