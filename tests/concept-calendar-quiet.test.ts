import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { DayGrid } from "@/concept/studio/calendar/day-grid";
import { NowLine } from "@/concept/studio/calendar/time-axis";
import { WeekAgenda } from "@/concept/studio/calendar/week-agenda";
import { WeekGrid } from "@/concept/studio/calendar/week-grid";

// A Wednesday at 10:30, inside opening hours.
const today = "2026-11-25";
const monday = "2026-11-23";
const minutes = 10 * 60 + 30;
const state = createDemoState(today);
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => ({ state, today, minutes }) }));

afterEach(() => setLocale("en"));

const count = (html: string, needle: string) => html.split(needle).length - 1;
const week = (staff = state.staff) => renderToStaticMarkup(createElement(WeekGrid, { monday, staff, onOpen: vi.fn(), onPickDay: vi.fn() }));

it("marks today in the week header as the current date, once", () => {
  const html = week();
  expect(count(html, 'aria-current="date"')).toBe(1);
  expect(html).toContain("studio-today-mark");
});

it("names each person once in a visible staff key, not under every day", () => {
  const html = week();
  const [anna, erik] = state.staff;
  expect(html).toContain(`aria-label="${t("calendar.staff")}"`);
  // The key once, plus the screen-reader name of each open day's column (six open days in the demo week).
  const openDays = 6;
  expect(count(html, `>${anna.firstName}<`)).toBe(1 + openDays);
  expect(count(html, `<span class="sr-only">${erik.firstName}</span>`)).toBe(openDays);
});

it("leaves the staff key out when the week shows one person", () => {
  expect(week([state.staff[0]])).not.toContain(`aria-label="${t("calendar.staff")}"`);
});

it("draws one now-line for the whole week with the time on the axis", () => {
  const html = week();
  expect(count(html, "data-calendar-now")).toBe(1);
  expect(html).toContain(">10:30<");
});

it("draws one now-line and one lunch label in the day view, not one per staff column", () => {
  const html = renderToStaticMarkup(createElement(DayGrid, { date: today, staff: state.staff, onOpen: vi.fn() }));
  expect(count(html, "data-calendar-now")).toBe(1);
  expect(count(html, `>${t("calendar.lunch")}<`)).toBe(1);
});

const day = (date = today) => renderToStaticMarkup(createElement(DayGrid, { date, staff: state.staff, onOpen: vi.fn() }));
const label = 'class="studio-calendar-lunch-label';

it("draws each day's lunch label behind bookings: right after the wash, before the column's bookings", () => {
  for (const html of [day(), week()]) {
    const labels = count(html, label);
    expect(labels).toBeGreaterThan(0);
    // Each label comes straight after its column's wash, so every booking of that column follows it in the DOM.
    expect(html.split(label).slice(0, -1).every((before) => /studio-calendar-lunch pointer-events-none[^>]*><\/div><div $/.test(before))).toBe(true);
    // Bookings sit on a layer above the label (studio.css), the label above the later columns' washes.
    expect(count(html, 'class="studio-calendar-booking ')).toBe(count(html, "data-calendar-booking="));
  }
  expect(count(day(), `>${t("calendar.lunch")}<`)).toBe(1);
  // One label per open day with lunch (Monday to Friday in the demo week), not one per staff column.
  expect(count(week(), `>${t("calendar.lunch")}<`)).toBe(5);
});

it("puts the lunch label over the working person when the first one is off", () => {
  const [anna] = state.staff;
  state.exceptions.push({ id: "test-off", staffId: anna.id, date: today, kind: "off", reason: "vacation" } as (typeof state.exceptions)[number]);
  try {
    const html = day();
    expect(count(html, `>${t("calendar.lunch")}<`)).toBe(1);
    // The label sits in the second person's column, spanning just that one column.
    const columns = html.split("cursor-copy");
    expect(columns).toHaveLength(2);
    expect(columns[1]).toContain(`${label} pointer-events-none absolute left-0`);
    expect(columns[1]).toContain("width:100%");
    expect(columns[0]).not.toContain(label);
  } finally {
    state.exceptions.pop();
  }
});

it("has no now-line outside the shown hours", () => {
  expect(renderToStaticMarkup(createElement(NowLine, { minutes: 6 * 60, from: 9 * 60, to: 18 * 60, pxPerMin: 1 }))).toBe("");
  expect(renderToStaticMarkup(createElement(NowLine, { minutes: 9 * 60, from: 9 * 60, to: 18 * 60, pxPerMin: 1 }))).toBe("");
});

it("keeps the treatment of a narrow week block hidden until it is measured whole", () => {
  const html = week();
  const bookings = count(html, "data-calendar-booking=");
  expect(bookings).toBeGreaterThan(0);
  expect(count(html, "whitespace-nowrap text-text-secondary invisible")).toBe(bookings);
});

it("marks today in the phone's week list in words, not by colour alone", () => {
  const html = renderToStaticMarkup(createElement(WeekAgenda, { monday, staff: state.staff, onOpen: vi.fn() }));
  expect(count(html, 'aria-current="date"')).toBe(1);
  expect(html).toContain(`>${t("date.today")}<`);
  // The old occupancy bar was a weak grey meter; utilisation belongs on Today, not in this list.
  expect(html).not.toContain("h-1.5 overflow-hidden");
});
