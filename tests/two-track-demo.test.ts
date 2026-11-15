import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import type { DemoBooking } from "../src/lib/two-track-demo";
import { advanceDemo, bookingExample } from "../src/lib/two-track-demo";

const harness = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, locale: "sv" as "sv" | "en" }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useRef: () => ({ current: null }), useId: () => "test-id", useEffect: () => {},
    useSyncExternalStore: () => true,
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.values)) harness.values[index] = typeof initial === "function" ? initial() : initial;
      return [harness.values[index], (value: unknown) => {
        harness.values[index] = typeof value === "function" ? value(harness.values[index]) : value;
      }];
    } };
});
vi.mock("../src/app/components/locale-provider", () => ({ useLocale: () => harness.locale }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../src/app/components/use-availability", () => ({ useAvailability: () => ({ slots: ["2026-11-16T09:00:00Z"], loading: false, error: "", refresh: vi.fn(), next: vi.fn() }) }));
import TwoTrackLab from "../src/app/two-track-lab";
import { DemoConfirmation } from "../src/app/demo-confirmation";
import BookingForm from "../src/app/booking-form";

function nodes(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function byId(tree: unknown, id: string) { return nodes(tree).find((n) => n.props["data-testid"] === id); }
function copy(tree: unknown) { return JSON.stringify(tree, (key, value) => ["type", "_owner", "_store"].includes(key) ? undefined : value); }
function render<T>(component: (props: T) => unknown, props: T) { harness.cursor = 0; return component(props); }
function click(node: ReactElement<Record<string, unknown>> | undefined) {
  expect(node).toBeDefined(); expect(node!.props.disabled).not.toBe(true);
  (node!.props.onClick as () => void)();
}
const booking: DemoBooking = { salon: "Salong Eko", serviceId: "fotvard", treatment: "Fotvård", duration: 60, priceOre: 65000, staffId: "staff-demo", person: "Anna", day: "2026-11-16", start: "2026-11-16T09:00:00Z" };
afterEach(() => { harness.values = []; harness.cursor = 0; harness.locale = "sv"; });

describe("two public booking paths", () => {
  it.each(["sv", "en"] as const)("offers both equal hero actions in %s", (locale) => {
    harness.locale = locale;
    const tree = render(TwoTrackLab, { children: createElement("form"), demoDate: booking.day, readOnly: true });
    expect(copy(byId(tree, "hero-book-self"))).toContain(locale === "sv" ? "Boka själv" : "Book yourself");
    expect(copy(byId(tree, "hero-book-agent"))).toContain(locale === "sv" ? "Låt din agent boka" : "Let your agent book");
    expect(nodes(tree).filter((n) => n.props["data-testid"] === "salon-card")).toHaveLength(3);
    expect(byId(tree, "track-tabs")?.props.role).toBe("tablist");
  });
  it("gates both tracks until salon selection, and preserves the server form", () => {
    const props = { children: createElement("form", { "data-testid": "server-form" }), demoDate: booking.day, readOnly: true };
    let tree = render(TwoTrackLab, props);
    const gates = nodes(tree).filter((n) => n.type === "fieldset");
    expect(gates).toHaveLength(2);
    expect(gates.every((n) => n.props.disabled === true && n.props.hidden === true)).toBe(true);
    expect(byId(tree, "server-form")).toBeDefined();
    expect(byId(tree, "customer-yes")).toBeUndefined();
    const card = byId(tree, "salon-card");
    click(nodes(card).find((n) => n.type === "button"));
    tree = render(TwoTrackLab, props);
    expect(nodes(tree).filter((n) => n.type === "fieldset").every((n) => n.props.disabled === false)).toBe(true);
    expect(copy(byId(tree, "tracks"))).toContain("Salong Eko");
  });
  it("keeps mobile tab controls operable in both directions", () => {
    const props = { children: null, demoDate: booking.day, readOnly: true };
    let tree = render(TwoTrackLab, props);
    click(nodes(byId(tree, "track-tabs")).find((n) => n.props.id === "tab-agent"));
    tree = render(TwoTrackLab, props);
    expect(nodes(tree).find((n) => n.props.id === "tab-agent")?.props["aria-selected"]).toBe(true);
    click(nodes(byId(tree, "track-tabs")).find((n) => n.props.id === "tab-customer"));
    tree = render(TwoTrackLab, props);
    expect(nodes(tree).find((n) => n.props.id === "tab-customer")?.props["aria-selected"]).toBe(true);
  });
  it("never accepts agent approval or payment before the customer's Yes", () => {
    expect(advanceDemo("review", "agent-yes", true)).toBe("review");
    expect(advanceDemo("review", "pay", true)).toBe("review");
    expect(advanceDemo("review", "customer-yes", false)).toBe("review");
    expect(advanceDemo("review", "customer-yes", true)).toBe("approved");
    expect(advanceDemo("declined", "pay", true)).toBe("declined");
  });
  it.each(["sv", "en"] as const)("requires customer Yes before a distinct simulated payment surface in %s", (locale) => {
    harness.locale = locale;
    const props = { booking, agent: true };
    let tree = render(DemoConfirmation, props);
    expect(byId(tree, "simulated-payment")).toBeUndefined();
    click(byId(tree, "customer-yes"));
    tree = render(DemoConfirmation, props);
    const payment = byId(tree, "simulated-payment");
    expect(copy(payment)).toContain(locale === "sv" ? "Simulerad förskottsbetalning" : "Simulated prepayment");
    expect(nodes(byId(tree, "agent-step")).some((n) => n.props["data-testid"] === "simulated-payment")).toBe(false);
    expect(nodes(tree).filter((n) => n.type === "input" || n.type === "iframe")).toHaveLength(0);
    click(byId(tree, "simulated-payment-confirm"));
    tree = render(DemoConfirmation, props);
    expect(copy(tree)).toContain("demo_payment_not_real");
    expect(copy(tree)).toContain(locale === "sv" ? "Inget sparades eller skickades" : "Nothing was saved or sent");
  });
  it("No removes approval and payment and permits a fresh explicit decision", () => {
    const props = { booking, agent: true };
    let tree = render(DemoConfirmation, props);
    click(byId(tree, "customer-no"));
    tree = render(DemoConfirmation, props);
    expect(byId(tree, "simulated-payment")).toBeUndefined();
    expect(copy(tree)).toContain("Inget mandat");
    const example = bookingExample(booking, "declined");
    expect(example.arguments.mandate).toBeNull(); expect(example.arguments.paymentToken).toBeNull();
    click(byId(tree, "customer-yes"));
    tree = render(DemoConfirmation, props);
    expect(byId(tree, "simulated-payment")).toBeDefined();
    click(byId(tree, "customer-no"));
    tree = render(DemoConfirmation, props);
    expect(byId(tree, "simulated-payment")).toBeUndefined();
  });
  it("presents the identical booking as a customer card and unsent JSON without credentials", () => {
    const tree = render(DemoConfirmation, { booking, agent: true });
    const card = copy(byId(tree, "booking-card"));
    const json = JSON.parse(nodes(byId(tree, "booking-json")).find((n) => n.type === "code")!.props.children as string);
    for (const field of ["salon", "treatment", "person"] as const) { expect(card).toContain(booking[field]); expect(json.arguments[field]).toBe(booking[field]); }
    expect(card).toContain("60"); expect(card).toContain("650"); expect(card).toContain("Stockholm");
    for (const [key, value] of Object.entries(booking)) expect(json.arguments[key]).toBe(value);
    expect(json.sent).toBe(false); expect(json.arguments.customerEmail).toBe("demo@example.test");
    expect(JSON.stringify(json)).not.toMatch(/Bearer|sk-proj-|apiKey|access_token/);
  });
  it("keeps readonly contact fields and network submit disabled while enabling a local selected-time demo", () => {
    const props = { readOnly: true, demoSalon: booking.salon, services: [{ id: booking.serviceId, name: booking.treatment, duration: 60, priceOre: 65000 }], staff: [{ id: booking.staffId, name: booking.person, serviceIds: [booking.serviceId] }], initialDate: booking.day, initialSlot: booking.start };
    const tree = render(BookingForm, props);
    expect(nodes(tree).filter((n) => n.type === "input" && ["name", "email"].includes(n.props.name as string)).every((n) => n.props.disabled === true)).toBe(true);
    expect(nodes(tree).find((n) => n.props.type === "submit")?.props.disabled).toBe(true);
    expect(nodes(tree).find((n) => n.type === DemoConfirmation)?.props.booking).toEqual(booking);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    (nodes(tree).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore();
  });
  it("preserves the normal customer POST and existing payload contract", async () => {
    const props = { readOnly: false, services: [{ id: booking.serviceId, name: booking.treatment, duration: 60, priceOre: 65000, version: 1 }], staff: [{ id: booking.staffId, name: booking.person, serviceIds: [booking.serviceId] }], initialDate: booking.day, initialSlot: booking.start };
    const tree = render(BookingForm, props);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ id: "demo-booking" }) } as Response);
    try {
      await (nodes(tree).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings", expect.objectContaining({ method: "POST" }));
      expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toMatchObject({ serviceId: booking.serviceId, staffId: booking.staffId, start: booking.start, serviceVersion: 1 });
    } finally { fetchSpy.mockRestore(); }
  });

});
