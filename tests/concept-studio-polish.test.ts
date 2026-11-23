import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { StaffSchedule } from "@/concept/studio/ops/staff-schedule";
import { NextDetails } from "@/concept/studio/today/next-customer";
import { WeekAgenda } from "@/concept/studio/calendar/week-agenda";
import { NewBookingSheet } from "@/concept/studio/booking/new-booking-sheet";
import { ThemeControls } from "@/concept/studio/page/theme-controls";
import { Segmented } from "@/concept/ui/controls";
import CustomersPage from "@/app/studio/customers/page";
import CustomerPage from "@/app/studio/customers/[id]/page";

const today = "2026-11-16";
const base = createDemoState(today);
let state = base;
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => ({ state, today, minutes: 540 }) }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("filter=birthdayThisMonth"),
  useParams: () => ({ id: state.customers[0].id }),
}));

beforeEach(() => { state = base; });
afterEach(() => setLocale("en"));

it("opens a shared treatment for the requested practitioner and explains when they have no treatments", () => {
  const [owner, colleague] = base.staff;
  const sheet = () => renderToStaticMarkup(createElement(NewBookingSheet, { preset: { date: today, staffId: colleague.id }, onClose: vi.fn() }));
  state = { ...base, services: [{ ...base.services[0], staffIds: [owner.id, colleague.id] }] };
  expect(sheet()).toContain(`<option value="${colleague.id}" selected=""`);
  state = { ...base, services: [{ ...base.services[0], staffIds: [owner.id] }] };
  expect(sheet()).toContain(t("newBooking.noStaffTreatments", { name: colleague.firstName }));
  expect(sheet()).not.toContain(t("newBooking.confirm"));
});

it.each(["en", "sv"] as const)("shows exact shifts and days off in %s", (locale) => {
  setLocale(locale);
  const person = { ...state.staff[0], week: { ...state.staff[0].week, 1: { start: 555, end: 1050 }, 2: null } };
  const html = renderToStaticMarkup(createElement(StaffSchedule, { person }));
  expect(html).toContain("09:15–17:30");
  expect(html).toContain(t("calendar.off"));
});

it.each(["", "  ", "070 123 45 67"])("only offers a call when the next customer has a number (%j)", (phone) => {
  const customer = { ...base.customers[0], phone };
  const booking = { ...base.bookings[0], customerId: customer.id, date: today, start: 550, status: "booked" as const };
  state = { ...base, customers: [customer], bookings: [booking] };
  const html = renderToStaticMarkup(createElement(NextDetails, { booking, onOpen: vi.fn() }));
  expect(html).toContain(t("next.profile"));
  expect(html.includes('href="tel:')).toBe(Boolean(phone.trim()));
  if (phone.trim()) expect(html).toContain('href="tel:0701234567"');
  const profile = renderToStaticMarkup(createElement(CustomerPage));
  expect(profile.includes('href="tel:')).toBe(Boolean(phone.trim()));
  expect(profile.includes(t("customer.noPhone"))).toBe(!phone.trim());
  expect(profile.includes(`>${t("customer.text")}</button>`)).toBe(Boolean(phone.trim()));
});

it("offers the whole customer list when a segment has no matches and the query is blank", () => {
  state = { ...base, customers: base.customers.map((customer) => ({ ...customer, birthday: undefined })) };
  const html = renderToStaticMarkup(createElement(CustomersPage));
  expect(html).toContain(t("customers.emptyFilter"));
  expect(html).toContain(t("customers.showAll"));
  expect(html).not.toContain(t("customers.emptyText"));
});

it("names the practitioner in a shared week agenda", () => {
  const person = { ...base.staff[1], firstName: "Kim" };
  state = { ...base, staff: [base.staff[0], person], bookings: [{ ...base.bookings[0], staffId: person.id, date: today, status: "booked" }] };
  const agenda = (staff: typeof state.staff) => renderToStaticMarkup(createElement(WeekAgenda, { monday: today, staff, onOpen: vi.fn() }));
  expect(agenda(state.staff)).toContain(">Kim<");
  expect(agenda([person])).not.toContain(">Kim<");
});

it("keeps the logo file picker out of layout and offers the Add logo button", () => {
  const html = renderToStaticMarkup(createElement(ThemeControls, { theme: base.page.theme, onChange: vi.fn() }));
  expect(html).toMatch(/<input\b(?=[^>]*\btype="file")(?=[^>]*\shidden="")[^>]*>/);
  expect(html).toContain(`${t("pageEditor.logo.add")}</button>`);
});

it("tabs to the selected segment and wraps arrow-key focus and selection together", () => {
  const onChange = vi.fn();
  const group = Segmented({ label: "View", value: "week", options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }], onChange });
  const buttons = group.props.children.props.children;
  expect(buttons.map((button: { props: { tabIndex: number } }) => button.props.tabIndex)).toEqual([-1, 0]);
  const targets = [{ focus: vi.fn() }, { focus: vi.fn() }];
  const event = { currentTarget: { parentElement: { querySelectorAll: () => targets } }, preventDefault: vi.fn() };
  buttons[1].props.onKeyDown({ ...event, key: "ArrowRight" });
  expect(targets[0].focus).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenLastCalledWith("day");
  buttons[0].props.onKeyDown({ ...event, key: "ArrowUp" });
  expect(targets[1].focus).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenLastCalledWith("week");
  buttons[1].props.onKeyDown({ ...event, key: "Tab" });
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenCalledTimes(2);
});
