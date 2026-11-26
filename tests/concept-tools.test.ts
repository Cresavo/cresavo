import { describe, expect, it } from "vitest";
import { z } from "zod";
import { reduce } from "@/concept/actions";
import { addDays, formatTime } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import { clientFromUserAgent } from "@/concept/tools/agent-proposal";
import { salonClock } from "@/concept/tools/clock";
import { ToolError, type ToolContext } from "@/concept/tools/define";
import { readTools, listBookings, getAvailability, getStock } from "@/concept/tools/read";
import { conceptTools, findTool } from "@/concept/tools/registry";
import { proposeCancel, proposeMove, proposePrice, writeTools } from "@/concept/tools/write";

// Monday 16 November 2026, 09:00 in the salon.
const today = "2026-11-16";
const clock = { today, minutes: 9 * 60 };
const fresh = (): ToolContext => ({ state: createDemoState(today), clock });

const upcoming = (context: ToolContext) =>
  context.state.bookings.find((b) => {
    if (b.status !== "booked" || b.date <= today) return false;
    const peer = context.state.bookings.some((o) => o.staffId === b.staffId && o.date === b.date && o.id !== b.id && o.status === "booked");
    if (!peer) return false;
    return freeStarts(context.state, b.staffId, b.date, b, { ignoreId: b.id }).some((start) => start !== b.start);
  })!;

function freeTarget(context: ToolContext, booking = upcoming(context)) {
  for (let i = 1; i < 30; i++) {
    const date = addDays(booking.date, i);
    const starts = freeStarts(context.state, booking.staffId, date, booking, { ignoreId: booking.id });
    if (starts.length) return { date, time: formatTime(starts[0]) };
  }
  throw new Error("no free day");
}

describe("tool registry", () => {
  it("has unique snake_case names and strict object inputs that convert to JSON Schema", () => {
    const names = conceptTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of conceptTools) {
      expect(tool.name).toMatch(/^[a-z][a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(z.toJSONSchema(tool.input)).toMatchObject({ type: "object", additionalProperties: false });
      expect(findTool(tool.name)).toBe(tool);
    }
  });

  it("covers reads for everything and proposals for the command box actions", () => {
    expect(readTools.map((t) => t.name)).toEqual(["get_business", "list_bookings", "get_availability", "list_customers", "list_services", "get_stock", "get_finance", "list_campaigns"]);
    expect(writeTools.every((t) => t.kind === "write" && t.name.startsWith("propose_"))).toBe(true);
  });

  it("rejects malformed input and unknown fields", () => {
    expect(listBookings.input.safeParse({ from: "16/11/2026" }).success).toBe(false);
    expect(listBookings.input.safeParse({ phone: "070" }).success).toBe(false);
    expect(proposeMove.input.safeParse({ bookingId: "b-1", date: today, time: "9:5" }).success).toBe(false);
    expect(proposeMove.input.safeParse({ bookingId: "b-1", date: today, time: "25:00" }).success).toBe(false);
    expect(proposePrice.input.safeParse({ serviceId: "s", priceSek: -5 }).success).toBe(false);
    expect(proposeMove.input.safeParse({ bookingId: "b-1", date: today, time: "14:30" }).success).toBe(true);
  });
});

describe("read tools", () => {
  it("never return customer contact details, notes, tags or birthdays", () => {
    const context = fresh();
    const results = readTools.map((tool) => {
      const input = tool.name === "get_availability" ? { serviceId: context.state.services[0].id, date: today } : tool.name === "list_customers" ? { limit: 50 } : {};
      return tool.run(context, tool.input.parse(input));
    });
    const keys = new Set<string>();
    JSON.stringify(results, (key, value) => (keys.add(key), value));
    for (const key of ["phone", "email", "birthday", "note", "tags", "observations", "advice", "journal"]) expect(keys.has(key), key).toBe(false);
    const output = JSON.stringify(results);
    const leaked = context.state.customers.filter((c) => output.includes(c.phone) || (c.email && output.includes(c.email)) || (c.note && output.includes(c.note)));
    expect(leaked.map((c) => c.id)).toEqual([]);
  });

  it("lists today's bookings by default, in time order, without cancelled ones", () => {
    const context = fresh();
    const result = listBookings.run(context, {}) as { from: string; bookings: { date: string; start: string; status: string }[] };
    expect(result.from).toBe(today);
    expect(result.bookings.length).toBeGreaterThan(0);
    expect(result.bookings.every((b) => b.date === today && b.status !== "cancelled")).toBe(true);
    const starts = result.bookings.map((b) => b.start);
    expect([...starts].sort()).toEqual(starts);
  });

  it("refuses a range longer than two weeks", () => {
    expect(() => listBookings.run(fresh(), { from: today, to: addDays(today, 20) })).toThrow(ToolError);
  });

  it("leaves out times that have passed today", () => {
    const context = fresh();
    const result = getAvailability.run(context, { serviceId: context.state.services[0].id, date: today }) as { staff: { starts: string[] }[] };
    expect(result.staff.flatMap((s) => s.starts).every((start) => start >= "09:00")).toBe(true);
  });

  it("answers module_off when the module is switched off", () => {
    const context = fresh();
    context.state = { ...context.state, modules: { ...context.state.modules, stock: false } };
    expect(() => getStock.run(context, {})).toThrow(expect.objectContaining({ code: "module_off" }));
  });
});

describe("write tools", () => {
  it("only draft a change: the state is untouched and the action is the command box's", () => {
    const context = fresh();
    const before = JSON.stringify(context.state);
    const booking = upcoming(context);
    const target = freeTarget(context, booking);
    const draft = proposeMove.draft(context, { bookingId: booking.id, ...target });
    expect(JSON.stringify(context.state)).toBe(before);
    expect(draft.action).toMatchObject({ type: "booking/move", id: booking.id, date: target.date });
    expect(draft.rows[0].before).toBeTruthy();
    const moved = reduce(context.state, draft.action).bookings.find((b) => b.id === booking.id)!;
    expect([moved.date, formatTime(moved.start)]).toEqual([target.date, target.time]);
  });

  it("offers alternatives when the wanted time is taken", () => {
    const context = fresh();
    const booking = upcoming(context);
    const other = context.state.bookings.find((b) => b.staffId === booking.staffId && b.date === booking.date && b.id !== booking.id && b.status === "booked")!;
    const attempt = () => proposeMove.draft(context, { bookingId: booking.id, date: other.date, time: formatTime(other.start) });
    expect(attempt).toThrow(ToolError);
    try {
      attempt();
    } catch (error) {
      expect((error as ToolError).code).toBe("not_possible");
      expect((error as ToolError).alternatives?.length).toBeGreaterThan(1);
    }
  });

  it("refuses unknown bookings", () => {
    expect(() => proposeCancel.draft(fresh(), { bookingId: "b-nope" })).toThrow(ToolError);
  });

  it("marks a cancellation as destructive", () => {
    const context = fresh();
    expect(proposeCancel.draft(context, { bookingId: upcoming(context).id }).destructive).toBe(true);
  });
});

describe("helpers", () => {
  it("reads the salon clock in Stockholm time", () => {
    expect(salonClock(new Date("2026-11-16T08:00:00Z"))).toEqual({ today, minutes: 9 * 60 });
    expect(salonClock(new Date("2026-11-16T23:30:00Z"))).toEqual({ today: "2026-11-17", minutes: 30 });
  });

  it("tells Claude and ChatGPT apart by user agent", () => {
    expect(clientFromUserAgent("claude-code/2.1.0")).toBe("claude");
    expect(clientFromUserAgent("openai-mcp/1.0.0")).toBe("chatgpt");
    expect(clientFromUserAgent("node")).toBe("agent");
    expect(clientFromUserAgent(null)).toBe("agent");
  });
});
