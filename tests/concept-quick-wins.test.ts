import { Children, createElement, isValidElement, useState, type ComponentProps, type Dispatch, type ReactElement, type ReactNode, type SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import SettingsPage from "@/app/studio/more/settings/page";
import { BookingActions } from "@/concept/booking/booking-actions";
import { BookingSummary } from "@/concept/booking/booking-summary";
import { Confirmation } from "@/concept/booking/confirmation";
import { bookingMessage, type BookingMessageKind, type MessageChannel } from "@/concept/booking/messages";
import { MessagePreviews } from "@/concept/booking/message-previews";
import { TimePicker } from "@/concept/booking/time-picker";
import { sellGiftCard } from "@/concept/giftcards/cards";
import { t } from "@/concept/i18n";
import { formatMoney } from "@/concept/i18n/format";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { currentState, dispatch, usePublicDemo, withBookingLock } from "@/concept/store";
import { RedeemSheet } from "@/concept/studio/giftcards/redeem-sheet";
import { ReminderSettings } from "@/concept/studio/more/reminder-settings";
import { useStudio } from "@/concept/studio/use-studio";
import { salonClock } from "@/concept/tools/clock";
import { ActionFailure } from "@/concept/ui/action-failure";
import { Button } from "@/concept/ui/button";
import { Field, Segmented, TextInput } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";
import { useSalonNow } from "@/concept/use-now";
import { englishDemoState, fixtureText } from "./concept-e2e/fixtures";

vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: vi.fn(react.useState) };
});
vi.mock("@/concept/store", () => ({
  currentState: vi.fn(),
  dispatch: vi.fn(),
  dispatchWithLog: vi.fn(),
  usePublicDemo: vi.fn(),
  withBookingLock: vi.fn(),
}));
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: vi.fn() }));
vi.mock("@/concept/use-now", () => ({ useSalonNow: vi.fn() }));
vi.mock("@/concept/studio/pairing/session", () => ({ usePairing: () => null }));

const fixture = englishDemoState("2026-11-17");
const copy = fixtureText(fixture);
const now = { today: "2026-11-17", minutes: 600 };
const booking = { ...fixture.bookings.find(item => item.date > now.today && item.status === "booked")!, date: "2026-11-21" };

afterEach(() => {
  vi.mocked(useState).mockReset();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function elements(tree: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  return Children.toArray(tree).flatMap(node =>
    isValidElement<{ children?: ReactNode }>(node) ? [node, ...elements(node.props.children)] : [],
  );
}

function propsOf<P>(tree: ReactNode, component: (props: P) => ReactNode): P[] {
  return elements(tree).filter(node => node.type === component).map(node => node.props as P);
}

// Run a component's handlers with the same state slots on each render, without a browser.
function stateful(render: () => ReactNode) {
  const slots: unknown[] = [];
  return () => {
    let index = 0;
    function useTestState<S>(initial?: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
      const slot = index++;
      if (slot === slots.length) slots.push(typeof initial === "function" ? (initial as () => S)() : initial);
      return [slots[slot] as S, next => {
        slots[slot] = typeof next === "function" ? (next as (value: S) => S)(slots[slot] as S) : next;
      }];
    }
    vi.mocked(useState).mockImplementation(useTestState);
    try {
      return render();
    } finally {
      vi.mocked(useState).mockReset();
    }
  };
}

function edit(input: ComponentProps<typeof TextInput>, value: string) {
  input.onChange?.({ target: { value } } as Parameters<NonNullable<typeof input.onChange>>[0]);
}

it("uses the fixture vocabulary in the summary and in the migration labels", () => {
  const salon = createSalon(now.today, { ...salonDraft(), name: "Studio Linden", slug: "studio-linden" });
  const salonCopy = fixtureText(salon);
  expect(copy("booking.summary.total")).toBe("Treatment total");
  expect(salonCopy("data.export.customers")).toBe("Clients (CSV)");
  expect(salonCopy("import.title")).toBe("Import clients");
});

it("retains the list price and qualifies salon payment when prepaid visits are available", () => {
  const summary = {
    slot: { ...booking, start: 900, date: now.today },
    price: booking.price, currency: "EUR", late: true, phone: fixture.salon.phone,
  };
  const price = formatMoney(booking.price, "EUR", "en");
  const withPackages = BookingSummary({ ...summary, packagesEnabled: true });
  const withoutPackages = BookingSummary({ ...summary, packagesEnabled: false });
  const amounts = (tree: ReactNode) => elements(tree).filter(node => node.type === "dd").map(node => node.props.children);
  expect(amounts(withPackages)).toEqual([price, formatMoney(0, "EUR", "en"), price]);
  expect(renderToStaticMarkup(withPackages)).toContain(copy("booking.summary.atSalonWithPackages"));
  expect(renderToStaticMarkup(withoutPackages)).toContain(`>${copy("booking.summary.atSalon")}<`);
});

it("renders the deadline and the late booking instructions as separate paragraphs", () => {
  const paragraphs = elements(BookingSummary({
    slot: { ...booking, date: now.today, start: 900 },
    price: booking.price, currency: "SEK", late: true, phone: fixture.salon.phone, packagesEnabled: false,
  })).filter(node => node.type === "p").map(node => node.props.children);
  expect(paragraphs).toContain(copy("booking.freeUntil", { day: "16 Nov 2026", time: "15:00", zone: "Europe/Stockholm" }));
  expect(paragraphs).toContain(copy("booking.summary.deadlinePassedPhone", { phone: fixture.salon.phone }));
});

it.each([
  ["completed", "booking.confirmation.completed"],
  ["noshow", "booking.confirmation.noshow"],
  ["booked", "booking.confirmation.past"],
] as const)("shows the historical visit for %s without inviting another calendar save", (status, heading) => {
  const past = { ...booking, date: "2026-11-16", status };
  vi.mocked(usePublicDemo).mockReturnValue({ ...fixture, bookings: [past] });
  vi.mocked(useSalonNow).mockReturnValue(now);
  const html = renderToStaticMarkup(createElement(Confirmation, { id: past.id }));
  expect(html).toContain(`>${copy(heading)}</h1>`);
  expect(html).toContain(copy("booking.me.rebook"));
  expect(html).not.toContain(copy("booking.confirmation.text"));
  expect(html).not.toContain(copy("booking.googleCalendar"));
});

it("keeps each message kind's channel while showing the same localized body that is sent", () => {
  const origin = new URL("http://localhost:3000");
  vi.mocked(dispatch).mockReturnValue(true);
  vi.stubGlobal("window", { location: origin, setTimeout: vi.fn() });
  const state = { ...fixture, localization: { ...fixture.localization, language: "sv" as const } };
  const render = stateful(() => MessagePreviews({ state, booking, now }));
  const channels = (tree: ReactNode) => propsOf(tree, Segmented<MessageChannel>)[1];
  const kinds = (tree: ReactNode) => propsOf(tree, Segmented<BookingMessageKind>)[0];

  channels(render()).onChange("email");
  expect(renderToStaticMarkup(render())).toContain(bookingMessage(state, booking, "confirmation").body);
  kinds(render()).onChange("reminder");
  expect(channels(render()).value).toBe("sms");
  expect(renderToStaticMarkup(render())).toContain(bookingMessage(state, booking, "reminder").body);
  propsOf(render(), Button).find(button => button.children === t("messages.simulate"))?.onClick?.({} as never);
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: "reminder", channel: "sms" }));
  channels(render()).onChange("email");
  kinds(render()).onChange("confirmation");
  expect(channels(render()).value).toBe("email");
  kinds(render()).onChange("reminder");
  expect(channels(render()).value).toBe("email");
});

it("shows a refused move on the page when its sheet was closed during the write", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T10:00:00+01:00"));
  const state = { ...fixture, bookings: [booking] };
  vi.mocked(currentState).mockReturnValue(state);
  let refuse!: (result: false) => void;
  vi.mocked(withBookingLock).mockImplementation(() => new Promise(resolve => { refuse = resolve; }));
  const render = stateful(() => BookingActions({ state, now, booking }));
  propsOf(render(), Button).find(button => button.children === t("booking.reschedule"))?.onClick?.({} as never);
  const moveSheet = () => propsOf(render(), Sheet).find(sheet => sheet.title === t("booking.move.title"))!;
  expect(moveSheet().open).toBe(true);
  propsOf(moveSheet().children, TimePicker)[0].onPick({ ...booking, date: "2026-11-20" });
  moveSheet().onClose();
  expect(moveSheet().open).toBe(false);
  refuse(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(renderToStaticMarkup(render())).toContain(t("booking.move.failed"));
});

it("uses December in reminder settings when it is still November on the owner's device", () => {
  const state = {
    ...fixture,
    bookings: [booking, { ...booking, date: "2026-11-30" }, { ...booking, date: "2026-12-01" }],
  };
  vi.mocked(useStudio).mockReturnValue({ state, today: "2026-11-30", minutes: 1110 });
  vi.mocked(useSalonNow).mockReturnValue(salonClock(new Date("2026-11-30T23:30:00Z")));
  const [props] = propsOf(stateful(SettingsPage)(), ReminderSettings);
  expect(props.today).toBe("2026-12-01");
  expect(renderToStaticMarkup(createElement(ReminderSettings, props))).toContain(copy("reminders.formula", {
    messages: 1, bookings: 1, price: "SEK\u00a00.45",
  }));
});

it.each(["EUR", "GBP", "USD"])("uses %s for reminder prices, monthly cost and validation", currency => {
  const state = {
    ...fixture, localization: { ...fixture.localization, currency },
    bookings: [booking, { ...booking, date: "2026-11-30" }],
  };
  const money = new Intl.NumberFormat("en-GB", { currency, style: "currency" });
  const render = stateful(() => ReminderSettings({ state, today: now.today }));
  expect(propsOf(render(), Field)[0].label).toBe(copy("reminders.smsPrice", { currency }));
  expect(renderToStaticMarkup(render())).toContain(money.format(0.45));
  expect(renderToStaticMarkup(render())).toContain(money.format(0.90));
  edit(propsOf(render(), TextInput)[0], "1000");
  expect(propsOf(render(), Field)[0].hint).toBe(copy("reminders.invalidPrice", { max: money.format(999.99) }));
});

it("shows the live gift card balance but creates a failure reference only on blur", () => {
  const state = sellGiftCard({ ...fixture, bookings: [booking] }, {
    amount: 500, recipient: "Fictional recipient", message: "", date: now.today,
  });
  vi.mocked(useStudio).mockReturnValue({ state, ...now });
  const card = state.giftCards.at(-1)!;
  const render = stateful(() => RedeemSheet({ bookingId: booking.id, onBack: vi.fn(), onClose: vi.fn() }));
  const input = () => propsOf(render(), TextInput)[0];
  for (let index = 1; index <= card.code.length; index++) {
    edit(input(), card.code.slice(0, index));
    expect(propsOf(render(), ActionFailure)).toEqual([]);
  }
  expect(elements(render()).some(node => node.type === "p" && node.props.children === copy("giftcards.payBalance", { amount: formatMoney(500) }))).toBe(true);
  edit(input(), "TEST-INVALID");
  expect(propsOf(render(), ActionFailure)).toEqual([]);
  input().onBlur?.({} as never);
  const [{ failure }] = propsOf(render(), ActionFailure);
  expect(failure.reason).toBe("giftcards.payNotFound");
  input().onBlur?.({} as never);
  expect(propsOf(render(), ActionFailure)[0].failure.requestId).toBe(failure.requestId);
  edit(input(), card.code);
  expect(propsOf(render(), ActionFailure)).toEqual([]);
});
