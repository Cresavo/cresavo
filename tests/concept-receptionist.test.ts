import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addressProof } from "../scripts/client-address.mjs";
import { reduce } from "@/concept/actions";
import { addDays, formatTime } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf, openingFor } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { receptionistSettings } from "@/concept/receptionist/actions";
import { CUT_MARK, ReceptionistCall, type ServerEvent } from "@/concept/receptionist/call-session";
import { Elks46NotConnected, elks46Transport } from "@/concept/receptionist/elks46";
import { STUDIO_PERMISSIONS_WITH_MICROPHONE } from "@/concept/receptionist/flag";
import { studioStoreHost } from "@/concept/receptionist/host";
import { defaultGreeting, openingInstruction, receptionistInstructions } from "@/concept/receptionist/instructions";
import { DEFAULT_LIMITS, estimateResponseCost, limitsFrom } from "@/concept/receptionist/limits";
import { realtimeModel, realtimeSession } from "@/concept/receptionist/realtime-config";
import { mintSession } from "@/concept/receptionist/server/session";
import { newCallMemory, receptionistToolSchemas, runReceptionistTool, type CallMemory } from "@/concept/receptionist/tools";
import { MAX_CALLS, type CallRecord } from "@/concept/receptionist/types";
import { MemoryStudioStore } from "@/concept/store/memory-studio-store";
import { contentSecurityPolicy } from "@/lib/csp";

// Monday 16 November 2026, 09:00 in Stockholm.
const NOW = Date.parse("2026-11-16T08:00:00Z");
const today = "2026-11-16";
const handover = { title: "Call back", body: ({ reason, caller, phone }: { reason: string; caller?: string; phone?: string }) => [reason, caller, phone].filter(Boolean).join(" | ") };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

function salon() {
  let now = NOW;
  const store = new MemoryStudioStore({ tenants: { demo: createDemoState(today) }, now: () => now });
  const host = studioStoreHost(store, "demo", () => now);
  const state = async () => (await store.load("demo"))!.state;
  return { store, host, state, advance: (ms: number) => { now += ms; }, now: () => now };
}

/** The first service with a free time on the first open day from tomorrow on. */
async function freeSlot(state: DemoState, skip = 0, from = 1) {
  for (let offset = from; offset < from + 14; offset++) {
    const date = addDays(today, offset);
    if (!openingFor(state.salon, date)) continue;
    for (const service of state.services) {
      for (const staffId of service.staffIds) {
        const starts = freeStarts(state, staffId, date, needOf(service));
        if (starts.length > skip) return { service, staffId, date, time: formatTime(starts[skip]) };
      }
    }
  }
  throw new Error("The sample salon has no free time in two weeks");
}

const run = (host: ReturnType<typeof salon>["host"], memory: CallMemory, tool: string, input: unknown) =>
  runReceptionistTool({ host, memory, handover }, tool, JSON.stringify(input));

describe("receptionist settings and call log", () => {
  const base = createDemoState(today);

  it("is off until the owner switches it on, and cleans the greeting", () => {
    expect(receptionistSettings(base)).toEqual({ enabled: false, greeting: "", answerWhen: "always" });
    const on = reduce(base, { type: "receptionist/settings", settings: { enabled: true, greeting: "  Hej\n\tdu  " } }, NOW);
    expect(on.receptionist).toEqual({ enabled: true, greeting: "Hej du", answerWhen: "always" });
    expect(reduce(on, { type: "receptionist/settings", settings: { enabled: true } }, NOW)).toBe(on);
    expect(reduce(on, { type: "receptionist/settings", settings: { answerWhen: "sometimes" as never } }, NOW)).toBe(on);
    expect(reduce(on, { type: "receptionist/settings", settings: { greeting: "x".repeat(900) } }, NOW).receptionist!.greeting).toHaveLength(240);
  });

  const call = (id: string, extra: Partial<CallRecord> = {}): CallRecord => ({
    id, channel: "browser-test", date: today, time: 540, durationSec: 61.4, outcome: "none", endedBy: "caller", costUsd: 0.012345, transcript: [{ who: "caller", text: " Hej \u0007 ", at: 2.6 }], ...extra,
  });

  it("keeps the newest calls, cleaned, and replaces a call saved twice", () => {
    let state = base;
    for (let i = 0; i < MAX_CALLS + 5; i++) state = reduce(state, { type: "receptionist/call", call: call(`call-${1000 + i}`) }, NOW);
    expect(state.receptionistCalls).toHaveLength(MAX_CALLS);
    expect(state.receptionistCalls![0]).toMatchObject({ id: `call-${1000 + MAX_CALLS + 4}`, durationSec: 61, costUsd: 0.0123, transcript: [{ who: "caller", text: "Hej", at: 3 }] });
    const again = reduce(state, { type: "receptionist/call", call: call(`call-${1000 + MAX_CALLS + 4}`, { outcome: "handover" }) }, NOW);
    expect(again.receptionistCalls).toHaveLength(MAX_CALLS);
    expect(again.receptionistCalls![0].outcome).toBe("handover");
  });

  it("erases a caller's calls with them and scrubs their name from other calls", () => {
    const customer = base.customers[0];
    const name = `${customer.firstName} ${customer.lastName}`;
    let state = reduce(base, { type: "receptionist/call", call: call("call-theirs", { customerId: customer.id }) }, NOW);
    state = reduce(state, { type: "receptionist/call", call: call("call-other", { handoverReason: `Asked about ${name}`, transcript: [{ who: "caller", text: `Jag ringer om ${name}`, at: 1 }] }) }, NOW);
    const erased = reduce(state, { type: "customer/erase", id: customer.id }, NOW);
    expect(erased.receptionistCalls!.map((saved) => saved.id)).toEqual(["call-other"]);
    expect(JSON.stringify(erased.receptionistCalls)).not.toContain(name);
  });

  it("refuses a malformed call and drops references to records the salon does not have", () => {
    expect(reduce(base, { type: "receptionist/call", call: call("x") }, NOW)).toBe(base);
    expect(reduce(base, { type: "receptionist/call", call: call("call-1234", { outcome: "won" as never }) }, NOW)).toBe(base);
    const saved = reduce(base, { type: "receptionist/call", call: call("call-1234", { bookingId: "b-nope", customerId: base.customers[0].id }) }, NOW).receptionistCalls![0];
    expect(saved.bookingId).toBeUndefined();
    expect(saved.customerId).toBe(base.customers[0].id);
  });
});

describe("receptionist tools", () => {
  it("answers about the salon from its own data", async () => {
    const { host, state } = salon();
    const info = await run(host, newCallMemory("call-a"), "get_salon_info", {});
    const current = await state();
    expect(info).toMatchObject({ ok: true, now: { date: today, time: "09:00" }, salon: { name: current.salon.name } });
    expect((info.treatments as { id: string }[]).map((t) => t.id)).toContain(current.services[0].id);
    expect(info.openingHours).toHaveLength(7);
  });

  it("offers only times the calendar has, and none on a closed day or outside the booking window", async () => {
    const { host, state } = salon();
    const current = await state();
    const slot = await freeSlot(current);
    const free = await run(host, newCallMemory("call-a"), "find_free_times", { serviceId: slot.service.id, date: slot.date, staffId: slot.staffId });
    expect((free.times as { time: string }[])[0]).toMatchObject({ time: slot.time, staffId: slot.staffId });
    expect(await run(host, newCallMemory("call-a"), "find_free_times", { serviceId: slot.service.id, date: addDays(today, 200) })).toMatchObject({ ok: false, error: "day_out_of_range" });
    expect(await run(host, newCallMemory("call-a"), "find_free_times", { serviceId: slot.service.id, date: addDays(today, -1) })).toMatchObject({ ok: false, error: "day_out_of_range" });
    const closed = Array.from({ length: 14 }, (_, i) => addDays(today, i)).find((date) => !openingFor(current.salon, date));
    if (closed) expect(await run(host, newCallMemory("call-a"), "find_free_times", { serviceId: slot.service.id, date: closed })).toMatchObject({ open: false, times: [] });
  });

  it("books only after the details were read back and confirmed", async () => {
    const { host, state } = salon();
    const before = await state();
    const slot = await freeSlot(before);
    const memory = newCallMemory("call-a");
    const details = { serviceId: slot.service.id, staffId: slot.staffId, date: slot.date, time: slot.time, callerName: "Robin Vale", callerPhone: "070-174 06 42" };

    // The model says "confirmed" without having read anything back: nothing is booked.
    const eager = await run(host, memory, "book_appointment", { ...details, confirmed: true });
    expect(eager).toMatchObject({ status: "needs_confirmation", readBack: { name: "Robin Vale", time: slot.time, treatment: slot.service.name } });
    expect((await state()).bookings).toHaveLength(before.bookings.length);

    // Confirming other details than the ones read back starts over.
    const other = await freeSlot(before, 1);
    expect(await run(host, memory, "book_appointment", { ...details, time: other.time, date: other.date, staffId: other.staffId, serviceId: other.service.id, confirmed: true })).toMatchObject({ status: "needs_confirmation" });
    expect(await run(host, memory, "book_appointment", { ...details, confirmed: true })).toMatchObject({ status: "needs_confirmation" });

    const booked = await run(host, memory, "book_appointment", { ...details, confirmed: true });
    expect(booked).toMatchObject({ ok: true, status: "booked" });
    const after = await state();
    const booking = after.bookings.find((b) => b.id === memory.bookingId)!;
    expect(booking).toMatchObject({ serviceId: slot.service.id, staffId: slot.staffId, date: slot.date, source: "phone", status: "booked" });
    expect(after.customers.find((c) => c.id === booking.customerId)).toMatchObject({ firstName: "Robin", lastName: "Vale" });
    expect(memory.outcome).toBe("booked");

    // The same confirmation again cannot book twice.
    expect(await run(host, memory, "book_appointment", { ...details, confirmed: true })).toMatchObject({ ok: false, error: "time_taken" });
    expect((await state()).bookings).toHaveLength(before.bookings.length + 1);
  });

  it("refuses a taken time, an unclear number and arguments that are not the tool's", async () => {
    const { host, state } = salon();
    const current = await state();
    const slot = await freeSlot(current);
    const details = { serviceId: slot.service.id, staffId: slot.staffId, date: slot.date, time: "03:00", callerName: "Robin Vale", callerPhone: "070-174 06 42", confirmed: false };
    expect(await run(host, newCallMemory("call-a"), "book_appointment", details)).toMatchObject({ ok: false, error: "time_taken" });
    expect(await run(host, newCallMemory("call-a"), "book_appointment", { ...details, time: slot.time, callerPhone: "1111111" })).toMatchObject({ ok: false, error: "phone_unclear" });
    expect(await run(host, newCallMemory("call-a"), "book_appointment", { ...details, extra: 1 })).toMatchObject({ ok: false, error: "invalid_arguments" });
    expect(await runReceptionistTool({ host, memory: newCallMemory("call-a"), handover }, "book_appointment", "{not json")).toMatchObject({ ok: false, error: "invalid_arguments" });
    expect(await run(host, newCallMemory("call-a"), "delete_everything", {})).toMatchObject({ ok: false, error: "unknown_tool" });
  });

  /** A booking made by phone at least a week ahead, so changing it is free of charge. */
  async function booked() {
    const world = salon();
    const slot = await freeSlot(await world.state(), 0, 8);
    const memory = newCallMemory("call-first");
    const details = { serviceId: slot.service.id, staffId: slot.staffId, date: slot.date, time: slot.time, callerName: "Robin Vale", callerPhone: "070-174 06 42" };
    await run(world.host, memory, "book_appointment", { ...details, confirmed: false });
    await run(world.host, memory, "book_appointment", { ...details, confirmed: true });
    return { ...world, bookingId: memory.bookingId!, details };
  }

  it("shows a caller only their own bookings, and only with both name and number", async () => {
    const { host, bookingId } = await booked();
    const memory = newCallMemory("call-b");
    expect(await run(host, memory, "find_booking", { callerName: "Someone Else", callerPhone: "070-174 06 42" })).toMatchObject({ found: false });
    expect(await run(host, memory, "find_booking", { callerName: "Robin Vale", callerPhone: "070-555 00 00" })).toMatchObject({ found: false });
    expect(memory.verified.size).toBe(0);
    const found = await run(host, memory, "find_booking", { callerName: "robin vale", callerPhone: "+46 70 174 06 42" });
    expect(found).toMatchObject({ found: true, bookings: [{ bookingId, canBeChangedByPhone: true }] });
    expect(memory.verified.has(bookingId)).toBe(true);
  });

  it("moves and cancels only a verified booking, after a read-back", async () => {
    const { host, state, bookingId, details } = await booked();
    const memory = newCallMemory("call-b");
    expect(await run(host, memory, "cancel_appointment", { bookingId, confirmed: true })).toMatchObject({ ok: false, error: "not_verified" });
    await run(host, memory, "find_booking", { callerName: "Robin Vale", callerPhone: details.callerPhone });

    const current = await state();
    const service = current.services.find((s) => s.id === details.serviceId)!;
    const target = formatTime(freeStarts(current, details.staffId, details.date, needOf(service), { ignoreId: bookingId }).find((start) => formatTime(start) !== details.time)!);
    expect(await run(host, memory, "move_appointment", { bookingId, date: details.date, time: target, confirmed: true })).toMatchObject({ status: "needs_confirmation" });
    expect(await run(host, memory, "move_appointment", { bookingId, date: details.date, time: target, confirmed: true })).toMatchObject({ status: "moved" });
    expect(formatTime((await state()).bookings.find((b) => b.id === bookingId)!.start)).toBe(target);

    expect(await run(host, memory, "cancel_appointment", { bookingId, confirmed: false })).toMatchObject({ status: "needs_confirmation" });
    expect(await run(host, memory, "cancel_appointment", { bookingId, confirmed: true })).toMatchObject({ status: "cancelled" });
    expect((await state()).bookings.find((b) => b.id === bookingId)?.status ?? "cancelled").toBe("cancelled");
    expect(memory.outcome).toBe("cancelled");
  });

  it("hands a change too close to the visit over to the staff", async () => {
    const { host, bookingId, details, advance } = await booked();
    // One hour before the visit.
    const visit = Date.parse(`${details.date}T${details.time}:00+01:00`);
    advance(visit - NOW - 3_600_000);
    const memory = newCallMemory("call-b");
    expect(await run(host, memory, "find_booking", { callerName: "Robin Vale", callerPhone: details.callerPhone })).toMatchObject({ bookings: [{ canBeChangedByPhone: false }] });
    expect(await run(host, memory, "cancel_appointment", { bookingId, confirmed: false })).toMatchObject({ ok: false, error: "needs_staff" });
  });

  it("leaves a note in the inbox when it hands over", async () => {
    const { host, state } = salon();
    const memory = newCallMemory("call-a");
    const before = (await state()).inbox.length;
    expect(await run(host, memory, "hand_over_to_staff", { reason: "Wants to talk about a complaint", callerName: "Robin Vale", callerPhone: "070-174 06 42" })).toMatchObject({ status: "note_left" });
    const inbox = (await state()).inbox;
    expect(inbox).toHaveLength(before + 1);
    expect(inbox[0]).toMatchObject({ kind: "message", title: "Call back", fromName: "Robin Vale", read: false });
    expect(inbox[0].body).toContain("complaint");
    expect(memory).toMatchObject({ outcome: "handover", handoverReason: "Wants to talk about a complaint" });
  });

  it("asks for a usable number before it promises a call back", async () => {
    const { host, state } = salon();
    const memory = newCallMemory("call-a");
    const before = (await state()).inbox.length;
    for (const callerPhone of [undefined, "12"]) {
      const input = { reason: "Wants to talk about a complaint", callerName: "Robin Vale", ...(callerPhone ? { callerPhone } : {}) };
      const output = await run(host, memory, "hand_over_to_staff", input);
      expect(output).toMatchObject({ ok: false });
      expect(output).not.toMatchObject({ status: "note_left" });
    }
    expect((await state()).inbox).toHaveLength(before);
    expect(memory.outcome).toBe("none");
  });
});

describe("receptionist call session", () => {
  const input = { salonName: "Salong Eko", language: "sv" as const, greeting: "" };

  function call(limits = DEFAULT_LIMITS) {
    const world = salon();
    const session = new ReceptionistCall({ id: "call-test-1", channel: "browser-test", host: world.host, salon: input, limits, handover, startedAt: { today, minutes: 540 }, now: world.now });
    return { ...world, session };
  }

  const toolCall = (name: string, args: unknown, usage?: object): ServerEvent => ({ type: "response.done", response: { usage, output: [{ type: "function_call", name, call_id: `c-${name}`, arguments: JSON.stringify(args) }] } });

  it("greets with the salon's greeting", () => {
    const { session } = call();
    expect(session.open()).toEqual([{ type: "response.create", response: { instructions: expect.stringContaining("Hej och välkommen till Salong Eko, det är Maja") } }]);
  });

  it("runs a tool call and asks for the next reply", async () => {
    const { session } = call();
    const step = await session.handle(toolCall("get_salon_info", {}));
    expect(step.hangUp).toBeUndefined();
    expect(step.send.map((event) => event.type)).toEqual(["conversation.item.create", "response.create"]);
    const item = step.send[0].item as { type: string; call_id: string; output: string };
    expect(item).toMatchObject({ type: "function_call_output", call_id: "c-get_salon_info" });
    expect(JSON.parse(item.output)).toMatchObject({ ok: true });
  });

  it("marks the reply the caller cut off, so the log does not show words that were never heard", async () => {
    const { session } = call();
    await session.handle({ type: "response.output_audio_transcript.done", item_id: "a", transcript: "Jag har halv tre." });
    await session.handle({ type: "response.output_audio_transcript.done", item_id: "b", transcript: "Då är det bokat. Nu behöver jag också ditt namn" });
    await session.handle({ type: "conversation.item.truncated", item_id: "b" });
    await session.handle({ type: "conversation.item.truncated", item_id: "b" });
    // A cut that arrives before its line still marks that line, not the one before it.
    await session.handle({ type: "conversation.item.truncated", item_id: "c" });
    await session.handle({ type: "response.output_audio_transcript.done", item_id: "c", transcript: "Vill du" });
    await session.handle({ type: "response.output_audio_transcript.done", item_id: "d", transcript: "Toppen." });
    await session.handle({ type: "conversation.item.truncated" });
    expect(session.record().transcript.map((line) => line.text)).toEqual(["Jag har halv tre.", `Då är det bokat. Nu behöver jag också ditt namn${CUT_MARK}`, `Vill du${CUT_MARK}`, "Toppen."]);
  });

  it("keeps the transcript and records a booked call", async () => {
    const { session, state, advance } = call();
    const slot = await freeSlot(await state());
    const details = { serviceId: slot.service.id, staffId: slot.staffId, date: slot.date, time: slot.time, callerName: "Robin Vale", callerPhone: "070-174 06 42" };
    await session.handle({ type: "response.output_audio_transcript.done", transcript: "Hej och välkommen" });
    advance(4000);
    await session.handle({ type: "conversation.item.input_audio_transcription.completed", transcript: "Jag vill boka en tid" });
    await session.handle(toolCall("book_appointment", { ...details, confirmed: false }));
    await session.handle(toolCall("book_appointment", { ...details, confirmed: true }, { output_token_details: { audio_tokens: 1000 } }));
    advance(20_000);
    const end = await session.handle(toolCall("end_call", {}));
    expect(end.hangUp).toBe("receptionist");
    // The goodbye is already said: no further reply is requested.
    expect(end.send.map((event) => event.type)).toEqual(["conversation.item.create"]);
    const record = session.record();
    expect(record).toMatchObject({ id: "call-test-1", channel: "browser-test", date: today, time: 540, outcome: "booked", endedBy: "receptionist", durationSec: 24, costUsd: 0.02 });
    expect(record.transcript).toEqual([{ who: "receptionist", text: "Hej och välkommen", at: 0 }, { who: "caller", text: "Jag vill boka en tid", at: 4 }]);
    const saved = reduce(await state(), { type: "receptionist/call", call: record }, NOW);
    expect(saved.receptionistCalls![0].bookingId).toBe(record.bookingId);
    // Nothing more happens after the call is over.
    expect(await session.handle(toolCall("get_salon_info", {}))).toEqual({ send: [] });
  });

  it("asks her to round off near the time limit and hangs up at it", () => {
    const { session, advance } = call({ maxSeconds: 60, maxCostUsd: 1 });
    expect(session.tick()).toEqual({ send: [] });
    advance(36_000);
    const wrap = session.tick();
    expect(wrap.send.map((event) => event.type)).toEqual(["conversation.item.create", "response.create"]);
    expect(session.tick()).toEqual({ send: [] });
    advance(24_000);
    expect(session.tick()).toEqual({ send: [], hangUp: "time-limit" });
    expect(session.record()).toMatchObject({ endedBy: "time-limit", durationSec: 60 });
  });

  it("hangs up when the estimated cost reaches the ceiling", async () => {
    const { session } = call({ maxSeconds: 300, maxCostUsd: 0.01 });
    const step = await session.handle({ type: "response.done", response: { usage: { output_token_details: { audio_tokens: 600 } }, output: [] } });
    expect(step.hangUp).toBe("cost-limit");
    expect(session.record().costUsd).toBeCloseTo(0.012);
  });

  it("estimates cost from token counts, cached input at its own rate", () => {
    expect(estimateResponseCost(undefined)).toBe(0);
    expect(estimateResponseCost({ input_token_details: { text_tokens: 1_000_000, audio_tokens: 0, cached_tokens_details: { text_tokens: 500_000 } } })).toBeCloseTo(0.33);
    expect(limitsFrom({ PHONE_RECEPTIONIST_MAX_SECONDS: "120", PHONE_RECEPTIONIST_MAX_COST_USD: "9999" })).toEqual({ maxSeconds: 120, maxCostUsd: DEFAULT_LIMITS.maxCostUsd });
  });
});

describe("receptionist rules and session config", () => {
  const input = { salonName: "Salong Eko", language: "sv" as const, greeting: "" };

  it("tells her to stay with the salon, confirm before booking and hand over when unsure", () => {
    const rules = receptionistInstructions(input);
    for (const phrase of ["Stay with the salon", "decline kindly", "read the details back", "wait for a clear yes", "hand_over_to_staff", "Never guess", "Never promise a confirmation by text", "other customers", "Speak Swedish"]) expect(rules).toContain(phrase);
    expect(receptionistInstructions({ ...input, language: "en" })).toContain("Speak English");
  });

  it("uses the owner's greeting, without line breaks or control characters", () => {
    expect(openingInstruction({ ...input, greeting: "Hej,\ndet här är Salong Eko.\u0000" })).toContain('"Hej, det här är Salong Eko."');
    expect(defaultGreeting("Salong Eko", "en")).toContain("AI receptionist");
  });

  it("declares the eight tools with closed schemas and starts on the mini model", () => {
    const tools = receptionistToolSchemas();
    expect(tools.map((tool) => tool.name)).toEqual(["get_salon_info", "find_free_times", "book_appointment", "find_booking", "move_appointment", "cancel_appointment", "hand_over_to_staff", "end_call"]);
    for (const tool of tools) expect(tool.parameters).toMatchObject({ type: "object", additionalProperties: false });
    expect(realtimeModel({})).toBe("gpt-realtime-mini");
    expect(realtimeModel({ PHONE_RECEPTIONIST_MODEL: "gpt-realtime-2.1-mini" })).toBe("gpt-realtime-2.1-mini");
    expect(realtimeModel({ PHONE_RECEPTIONIST_MODEL: "../evil" })).toBe("gpt-realtime-mini");
    const session = realtimeSession({ ...input, model: "gpt-realtime-mini" });
    expect(session).toMatchObject({ type: "realtime", model: "gpt-realtime-mini", audio: { input: { transcription: { language: "sv" } } } });
    expect(session.tools).toHaveLength(8);
  });

  it("keeps the 46elks transport a stub", () => {
    expect(() => elks46Transport({}, { onEvent: () => undefined, onOpen: () => undefined, onClose: () => undefined })).toThrow(Elks46NotConnected);
  });
});

describe("receptionist server", () => {
  const input = { salonName: "Salong Eko", language: "sv" as const, greeting: "" };
  const KEY = "fictional-provider-key";

  it("exchanges the key for a one-minute client secret and never returns the key", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ value: "ek_fictional", expires_at: 1_800_000_000 }));
    const minted = await mintSession(input, { apiKey: KEY, client: "203.0.113.5", env: {}, fetch: fetcher });
    expect(minted).toMatchObject({ ok: true, session: { clientSecret: "ek_fictional", expiresAt: 1_800_000_000, model: "gpt-realtime-mini", limits: DEFAULT_LIMITS } });
    expect(JSON.stringify(minted)).not.toContain(KEY);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers["OpenAI-Safety-Identifier"]).toMatch(/^[0-9a-f]{32}$/);
    const body = JSON.parse(init!.body as string);
    expect(body.expires_after).toEqual({ anchor: "created_at", seconds: 60 });
    expect(body.session.tools).toHaveLength(8);
  });

  it("reports a provider failure without its message", async () => {
    expect(await mintSession(input, { apiKey: KEY, client: "c", env: {}, fetch: (async () => Response.json({ error: { message: `bad key ${KEY}` } }, { status: 401 })) as typeof fetch })).toEqual({ ok: false, reason: "provider" });
    expect(await mintSession(input, { apiKey: KEY, client: "c", env: {}, fetch: (async () => { throw new Error(KEY); }) as typeof fetch })).toEqual({ ok: false, reason: "provider" });
  });

  const secret = "fictional-address-signing-secret";
  const request = (ip: string, extra: Record<string, string> = {}, body: unknown = input) =>
    new Request("http://localhost/api/concept/receptionist/session", {
      method: "POST", body: JSON.stringify(body),
      headers: { origin: "http://localhost", "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, secret), ...extra },
    });

  async function routes(env: Record<string, string>) {
    vi.stubEnv("BOOKING_ADDRESS_SECRET", secret);
    vi.stubEnv("BOOKING_RUNTIME", "local");
    vi.stubEnv("CONCEPT_AI_STORE_DIR", "/nonexistent/receptionist-test");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => Response.json({ value: "ek_fictional", expires_at: 1_800_000_000 }));
    vi.stubGlobal("fetch", fetcher);
    const status = (await import("../src/app/api/concept/receptionist/route")).GET;
    const start = (await import("../src/app/api/concept/receptionist/session/route")).POST;
    return { fetcher, status: () => status(new Request("http://localhost/api/concept/receptionist"), {} as never), start: (req: Request) => start(req, {} as never) };
  }

  it("is switched off by default: no status, no session, no provider call", async () => {
    const { status, start, fetcher } = await routes({ OPENAI_API_KEY: KEY });
    expect(await (await status()).json()).toMatchObject({ enabled: false, configured: false });
    expect((await start(request("203.0.113.1"))).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("starts a call only for a same-origin studio, with a key, a valid request and writes allowed", async () => {
    const off = await routes({ PHONE_RECEPTIONIST_ENABLED: "1" });
    expect(await (await off.status()).json()).toMatchObject({ enabled: true, configured: false });
    expect((await off.start(request("203.0.113.1"))).status).toBe(503);
    vi.resetModules();

    const on = await routes({ PHONE_RECEPTIONIST_ENABLED: "1", OPENAI_API_KEY: KEY });
    const statusBody = await (await on.status()).text();
    expect(JSON.parse(statusBody)).toMatchObject({ enabled: true, configured: true, model: "gpt-realtime-mini" });
    expect(statusBody).not.toContain(KEY);
    expect((await on.start(request("203.0.113.1", { origin: "https://evil.example" }))).status).toBe(403);
    expect((await on.start(request("203.0.113.1", {}, { ...input, tools: [] }))).status).toBe(400);
    expect((await on.start(request("203.0.113.1", { "x-booking-client-proof": "forged" }))).status).toBe(403);
    expect(on.fetcher).not.toHaveBeenCalled();
    const ok = await on.start(request("203.0.113.1"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const text = await ok.text();
    expect(JSON.parse(text)).toMatchObject({ clientSecret: "ek_fictional", callId: expect.stringMatching(/^call-/) });
    expect(text).not.toContain(KEY);
    vi.resetModules();

    const readonly = await routes({ PHONE_RECEPTIONIST_ENABLED: "1", OPENAI_API_KEY: KEY, PUBLIC_READONLY: "1" });
    expect((await readonly.start(request("203.0.113.1"))).status).toBe(403);
  });

  it("rations calls per visitor and per day", async () => {
    const { start } = await routes({ PHONE_RECEPTIONIST_ENABLED: "1", OPENAI_API_KEY: KEY });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await start(request("203.0.113.9"))).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    let allowed = 3;
    for (let a = 0; a < 20; a++) for (let i = 0; i < 3; i++) if ((await start(request(`198.51.100.${a + 1}`))).status === 200) allowed++;
    expect(allowed).toBe(40);
  });
});

describe("receptionist browser permissions", () => {
  it("lets scripts reach the Realtime API only when asked to", () => {
    expect(contentSecurityPolicy("n", "/studio", true)).toMatch(/connect-src 'self'$/);
    expect(contentSecurityPolicy("n", "/studio", true, ["https://api.openai.com"])).toMatch(/connect-src 'self' https:\/\/api\.openai\.com$/);
  });

  it("changes nothing in the site-wide permissions but the studio's microphone", () => {
    const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    const base = /const permissionsPolicy = "([^"]+)"/.exec(config)![1];
    expect(STUDIO_PERMISSIONS_WITH_MICROPHONE).toBe(base.replace("microphone=()", "microphone=(self)"));
  });
});
