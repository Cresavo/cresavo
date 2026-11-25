import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailsStep } from "@/concept/booking/details-step";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { setLocale } from "@/concept/i18n";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { ServerSalonProvider, useServerBook, type ServerBookingInput } from "@/concept/server-salon";

// The booking page on a salon the server sent: the form it shows, and how it
// books: one key per attempt, a second try when the salon is busy, free times
// reloaded when the time was taken. The network is a stub. Fictional data only.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const base = payAtSalon(createDemoState("2026-11-16"));
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
    const state = publicState({ cancellationPolicy: { ...base.cancellationPolicy, payAtSalonDefault: false, deposits: { [service.id]: 20000 } } });
    const html = renderDetails(state);
    expect(html).toContain(`This treatment needs a deposit. Please call the salon on ${state.salon.phone} to book it.`);
    expect(html).not.toContain("<form");
    setLocale("sv");
    expect(renderDetails(state)).toContain(`Ring salongen på ${state.salon.phone} för att boka den.`);
  });

  it("says the same when the deposit is for new customers only: no guest is known to the page, so none is exempt", () => {
    const state = publicState({ cancellationPolicy: { ...base.cancellationPolicy, payAtSalonDefault: false, deposits: { [service.id]: 20000 }, newCustomersOnly: true } });
    const html = renderDetails(state);
    expect(html).toContain("This treatment needs a deposit");
    expect(html).not.toContain("<form");
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

  it("sends one request with the key, the form-time token and the terms the customer saw, and returns the visit under its public reference", async () => {
    fetchMock.mockImplementation(() => reply(201, { ref: "ref-77", duration: service.duration }));
    const result = await book(input);
    expect(result).toMatchObject({ ok: true, booking: { id: "ref-77", serviceId: service.id, date: "2026-11-17", start: 600, status: "booked", source: "online" } });
    const [url, init] = posts()[0];
    expect(url).toBe("/api/public/salons/salong-fiktiv/bookings");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({ ...input, language: "en", issuedAt: "fictional-token", terms: acceptedTerms(publicState(), service) });
  });

  it("waits as long as the salon asks, then tries once more with the same key, and no more than once", async () => {
    vi.useFakeTimers();
    const busy = () => Promise.resolve(new Response("{}", { status: 503, headers: { "Retry-After": "3" } }));
    fetchMock.mockImplementationOnce(busy).mockImplementationOnce(() => reply(201, { ref: "ref-78", duration: service.duration }));
    const pending = book(input);
    await vi.advanceTimersByTimeAsync(2999);
    expect(posts()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: true });
    expect(posts().map(([, init]) => init.headers["Idempotency-Key"])).toEqual([expect.any(String), expect.any(String)]);
    fetchMock.mockReset().mockImplementation(busy);
    const again = book(input);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await again).toEqual({ ok: false, reason: "unavailable" });
    expect(posts()).toHaveLength(2);
    vi.useRealTimers();
  });

  it("sends one key with one exact body: a retry after a lost answer re-sends it, a changed form or language gets a new key", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? reply(201, { ref: "ref-79", duration: service.duration }) : reply(200, { state: publicState(), issuedAt: "fresh" }));
    expect(await book(input)).toEqual({ ok: false, reason: "unavailable" });
    expect(await book(input)).toMatchObject({ ok: true });
    const [lost, retried] = posts().map(([, init]) => [init.headers["Idempotency-Key"], init.body]);
    expect(retried).toEqual(lost);
    // The token was refreshed by the reload in between, yet the body that was first sent is what travels again.
    expect(JSON.parse(retried[1]).issuedAt).toBe("fictional-token");
    fetchMock.mockReset().mockRejectedValue(new Error("offline"));
    await book({ ...input, name: "Lisa Berg-Lind" });
    await book({ ...input, name: "Lisa Berg-Lind" });
    setLocale("sv");
    await book({ ...input, name: "Lisa Berg-Lind" });
    const keys = posts().map(([, init]) => init.headers["Idempotency-Key"]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("says when to try again after too many attempts, without reloading the free times", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 429, headers: { "Retry-After": "600" } })));
    expect(await book(input)).toEqual({ ok: false, reason: "rate_limited", minutes: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reloads the free times when the time was taken, or the terms changed", async () => {
    for (const error of ["slot_unavailable", "terms_changed"]) {
      fetchMock.mockReset().mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? reply(409, { error }) : reply(200, { state: publicState(), issuedAt: "fresh" }));
      expect(await book(input)).toEqual({ ok: false, reason: error });
      const gets = fetchMock.mock.calls.filter(([, init]) => !init?.method);
      expect(gets.map(([url]) => url)).toEqual(["/api/public/salons/salong-fiktiv"]);
    }
  });

  it("reports a deposit without reloading, and a failed request as unavailable", async () => {
    fetchMock.mockImplementation(() => reply(409, { error: "deposit_unsupported" }));
    expect(await book(input)).toEqual({ ok: false, reason: "deposit_unsupported" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset().mockRejectedValue(new Error("offline"));
    expect(await book(input)).toEqual({ ok: false, reason: "unavailable" });
  });
});
