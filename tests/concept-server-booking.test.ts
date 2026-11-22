import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailsStep } from "@/concept/booking/details-step";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import { setLocale } from "@/concept/i18n";
import { ServerSalonProvider, useServerBook, type ServerBookingInput } from "@/concept/server-salon";

// The booking page on a salon the server sent: the form it shows, and how it
// books: one key per attempt, a second try when the salon is busy, free times
// reloaded when the time was taken. The network is a stub. Fictional data only.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const base = createDemoState("2026-11-16");
const publicState = (over: Partial<typeof base> = {}) => publicSalonView({ ...base, salon: { ...base.salon, slug: "salong-fiktiv" }, ...over }, NOW);
const service = base.services[0];

const Server = ServerSalonProvider as unknown as ComponentType<{ state: ReturnType<typeof publicState>; issuedAt: string; children?: ReactNode }>;

function renderDetails(state = publicState()) {
  const slot = { staffId: service.staffIds[0], date: "2026-11-17", start: 600 };
  const props = {
    state, now: { today: "2026-11-16", minutes: 600, instant: NOW.getTime() }, serviceId: service.id, slot, suggested: false,
    contact: { guest: { name: "", phone: "" }, setGuest: () => undefined, remember: false, chooseRemember: () => undefined },
    onTaken: () => undefined, onBooked: () => undefined, onHeld: () => undefined,
  };
  return renderToString(createElement(Server, { state, issuedAt: "fictional-token" }, createElement(DetailsStep, props as never)));
}

afterEach(() => setLocale("en"));

describe("the details step on a salon from the server", () => {
  it("asks for name, mobile and e-mail, with the processor notice and a hidden honeypot, instead of saying booking is closed", () => {
    const html = renderDetails();
    expect(html).not.toContain("opens soon");
    expect(html).toContain("<form");
    expect(html).toContain('type="email"');
    expect(html).toMatch(/aria-hidden="true"[^>]*><input[^>]*name="website"/);
    expect(html).toMatch(/<input[^>]*tabindex="-1"[^>]*>/);
    expect(html).toContain("Cresavo handles them on the salon&#x27;s behalf");
    expect(html).not.toContain("Demo booking");
    expect(html).not.toContain("Remember");
  });

  it("says so, with the salon's phone, before collecting details, when the treatment needs a deposit", () => {
    const state = publicState({ cancellationPolicy: { ...base.cancellationPolicy, deposits: { [service.id]: 20000 } } });
    const html = renderDetails(state);
    expect(html).toContain(`This treatment needs a deposit. Please call the salon on ${state.salon.phone} to book it.`);
    expect(html).not.toContain("<form");
    setLocale("sv");
    expect(renderDetails(state)).toContain(`Ring salongen på ${state.salon.phone} för att boka den.`);
  });

  it("leaves the decision to the server when the deposit is for new customers only, which it cannot tell apart here", () => {
    const state = publicState({ cancellationPolicy: { ...base.cancellationPolicy, deposits: { [service.id]: 20000 }, newCustomersOnly: true } });
    expect(renderDetails(state)).toContain("<form");
  });
});

describe("booking on a salon from the server", () => {
  const input: ServerBookingInput = { serviceId: service.id, staffId: service.staffIds[0], date: "2026-11-17", start: 600, name: "Lisa Berg", phone: "073-555 01 02", email: "lisa@example.test", website: "" };
  const fetchMock = vi.fn();
  type Book = NonNullable<ReturnType<typeof useServerBook>>;
  let book: Book;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    const Probe = () => { book = useServerBook()!; return null; };
    renderToString(createElement(Server, { state: publicState(), issuedAt: "fictional-token" }, createElement(Probe)));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const reply = (status: number, body: Record<string, unknown>) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

  it("sends one request with the key, the form-time token and what the customer saw, and returns the visit", async () => {
    fetchMock.mockImplementation(() => reply(201, { bookingId: "b-77", duration: service.duration }));
    const result = await book(input, "key-1");
    expect(result).toMatchObject({ ok: true, booking: { id: "b-77", serviceId: service.id, date: "2026-11-17", start: 600, status: "booked", source: "online" } });
    const [url, init] = posts()[0];
    expect(url).toBe("/api/public/salons/salong-fiktiv/bookings");
    expect(init.headers).toMatchObject({ "Idempotency-Key": "key-1" });
    expect(JSON.parse(init.body)).toEqual({ ...input, language: "en", issuedAt: "fictional-token", price: service.price, duration: service.duration });
  });

  it("tries once more with the same key when the salon is busy, and no more than once", async () => {
    fetchMock.mockImplementationOnce(() => reply(503, { error: "unavailable" })).mockImplementationOnce(() => reply(201, { bookingId: "b-78", duration: service.duration }));
    expect(await book(input, "key-2")).toMatchObject({ ok: true });
    expect(posts().map(([, init]) => init.headers["Idempotency-Key"])).toEqual(["key-2", "key-2"]);
    fetchMock.mockReset().mockImplementation(() => reply(503, { error: "unavailable" }));
    expect(await book(input, "key-3")).toEqual({ ok: false, reason: "unavailable" });
    expect(posts()).toHaveLength(2);
  });

  it("reloads the free times when the time was taken, or the terms changed", async () => {
    for (const error of ["slot_unavailable", "terms_changed"]) {
      fetchMock.mockReset().mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? reply(409, { error }) : reply(200, { state: publicState(), issuedAt: "fresh" }));
      expect(await book(input, "key-4")).toEqual({ ok: false, reason: error });
      const gets = fetchMock.mock.calls.filter(([, init]) => !init?.method);
      expect(gets.map(([url]) => url)).toEqual(["/api/public/salons/salong-fiktiv"]);
    }
  });

  it("reports a deposit without reloading, and a failed request as unavailable", async () => {
    fetchMock.mockImplementation(() => reply(409, { error: "deposit_unsupported" }));
    expect(await book(input, "key-5")).toEqual({ ok: false, reason: "deposit_unsupported" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset().mockRejectedValue(new Error("offline"));
    expect(await book(input, "key-6")).toEqual({ ok: false, reason: "unavailable" });
  });
});
