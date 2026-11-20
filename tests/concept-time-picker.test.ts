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

it("does not offer the waiting list while a visit is being moved", () => {
  const full = { ...base, bookings: [...base.bookings], modules: { ...base.modules, waitlist: true } };
  const service = full.services.find((s) => s.id === serviceId)!;
  // Every person who does the treatment is busy every day of the next four weeks.
  for (let i = 0; i < 29; i++) for (const staffId of service.staffIds) {
    full.bookings.push({ ...base.bookings[0], id: `busy-${staffId}-${i}`, staffId, serviceId, date: addDays(clock.today, i), start: 0, duration: 1440, status: "booked" });
  }
  const picker = (props: Partial<Parameters<typeof TimePicker>[0]>) => renderToStaticMarkup(createElement(TimePicker, { state: full, serviceId, clock, onPick: () => {}, ...props }));
  expect(picker({ onWaitlist: () => {} })).toContain("Notify me");
  expect(picker({ ignoreId: base.bookings[0].id })).not.toContain("Notify me");
});
