import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { buildIntentContext } from "@/concept/command/intent-context";
import { clarifyChoices } from "@/concept/command/clarify";
import { commandExamples } from "@/concept/command/examples";
import { proposalFor, type Proposal } from "@/concept/command/proposal";
import { addDays, formatTime } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import { interpretCommand } from "@/concept/intent";
import { fullName, revenueBetween } from "@/concept/selectors";

// Monday. The demo is generated for this day, and the clock is fixed at 09:00.
const today = "2026-11-16";
const clock = { today, minutes: 9 * 60 };
const state = createDemoState(today);
const context = buildIntentContext(state, today, clock.minutes);
const examples = commandExamples(state, today);

function propose(text: string): Proposal {
  return proposalFor(state, interpretCommand(text, context), text, clock, examples);
}

const upcoming = state.bookings.filter((b) => b.status === "booked" && b.date > today);
const single = upcoming.find((b) => upcoming.filter((o) => o.customerId === b.customerId).length === 1 && state.customers.filter((c) => fullName(c) === fullName(state.customers.find((x) => x.id === b.customerId)!)).length === 1)!;
const owner = state.customers.find((c) => c.id === single.customerId)!;

function freeDay(staffId: typeof single.staffId, duration: number) {
  for (let i = 1; i < 30; i++) {
    const date = addDays(today, i);
    const starts = freeStarts(state, staffId, date, duration, { ignoreId: single.id });
    if (starts.length) return { date, starts };
  }
  throw new Error("no free day in the demo data");
}

describe("buildIntentContext", () => {
  it("maps names, durations and prices", () => {
    expect(context.customers).toHaveLength(state.customers.length);
    expect(context.staff).toEqual([{ id: "anna", name: "Anna" }, { id: "erik", name: "Erik" }]);
    expect(context.services[0]).toMatchObject({ id: state.services[0].id, durationMin: state.services[0].duration, priceSek: state.services[0].price });
  });

  it("includes only upcoming booked appointments, with salon-time offsets", () => {
    expect(context.bookings.length).toBeGreaterThan(0);
    expect(context.bookings.length).toBeLessThan(state.bookings.length);
    const booking = state.bookings.find((b) => b.id === single.id)!;
    const entry = context.bookings.find((b) => b.id === single.id)!;
    expect(entry.start.startsWith(`${booking.date}T${formatTime(booking.start)}`)).toBe(true);
    expect(entry.start).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(context.now.startsWith(`${today}T09:00`)).toBe(true);
    expect(context.bookings.every((b) => state.bookings.find((x) => x.id === b.id)!.status === "booked")).toBe(true);
  });
});

describe("proposals", () => {
  it("proposes a move to a free time that the store accepts", () => {
    const { date, starts } = freeDay(single.staffId, single.duration);
    const proposal = propose(`Move ${fullName(owner)} to ${date} at ${formatTime(starts[0])}`);
    if (proposal.kind !== "change") throw new Error(`expected a change, got ${proposal.kind}`);
    expect(proposal.action).toEqual({ type: "booking/move", id: single.id, date, start: starts[0] });
    expect(proposal.rows[0].before).toContain(formatTime(single.start));
    const next = reduce(state, proposal.action);
    expect(next.bookings.find((b) => b.id === single.id)).toMatchObject({ date, start: starts[0] });
  });

  it("offers nearby free times when the wanted time is taken", () => {
    const service = state.services.find((s) => s.id === single.serviceId)!;
    const other = state.bookings.find((b) => b.status === "booked" && b.date > today && b.staffId === single.staffId && b.id !== single.id)!;
    const proposal = propose(`Move ${fullName(owner)} to ${other.date} at ${formatTime(other.start)}`);
    expect(["choose", "message"]).toContain(proposal.kind);
    if (proposal.kind === "choose") {
      for (const choice of proposal.choices) {
        if (!("proposal" in choice) || choice.proposal.kind !== "change") throw new Error("each choice should be a change");
        expect(reduce(state, choice.proposal.action)).not.toBe(state);
      }
    }
    expect(service.staffIds).toContain(single.staffId);
  });

  it("books by day part with up to three tappable times", () => {
    const text = `Book ${fullName(owner)} for ${state.services[1].name} on ${freeDay("anna", state.services[1].duration).date} in the morning`;
    const proposal = propose(text);
    expect(["choose", "change", "message"]).toContain(proposal.kind);
    if (proposal.kind === "choose") expect(proposal.choices.length).toBeLessThanOrEqual(3);
    if (proposal.kind === "change") expect(proposal.action).toMatchObject({ type: "booking/create", source: "assistant" });
  });

  it("cancels with a waiting-list notice only when asked", () => {
    const plain = propose(`Cancel ${fullName(owner)}`);
    if (plain.kind !== "change" || plain.action.type !== "booking/cancel") throw new Error("expected a cancel");
    expect(plain.action.notice).toBeUndefined();
    const offered = propose(`Cancel ${fullName(owner)} and offer the slot to the waiting list`);
    if (offered.kind !== "change" || offered.action.type !== "booking/cancel") throw new Error("expected a cancel");
    expect(offered.action.notice?.kind).toBe("system");
    expect(reduce(state, offered.action).bookings.find((b) => b.id === single.id)?.status).toBe("cancelled");
  });

  it("answers revenue questions with the same numbers the selectors give", () => {
    const proposal = propose("What have I earned this month?");
    if (proposal.kind !== "revenue") throw new Error("expected a revenue answer");
    const expected = revenueBetween(state, today, clock.minutes, "2026-11-01", "2026-12-01");
    expect(proposal.total).toBe(expected.total);
    expect(proposal.visits).toBe(expected.visits);
    expect(proposal.bars.reduce((sum, bar) => sum + bar.value, 0)).toBeLessThanOrEqual(proposal.total);
  });

  it("lists customers who have not been back", () => {
    const proposal = propose("Which customers haven't been here since summer?");
    if (proposal.kind !== "customers") throw new Error("expected a customer list");
    expect(proposal.total).toBeGreaterThan(0);
    expect(proposal.items.length).toBeLessThanOrEqual(8);
  });

  it("opens the campaign studio for a discount and turns a price command into a price change", () => {
    const campaign = propose(`15% off ${state.services[1].name} this month`);
    if (campaign.kind !== "message" || !campaign.link) throw new Error("expected a link to the studio");
    const query = new URL(campaign.link.href, "https://example.test").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ percent: "15", from: today, to: "2026-11-30", services: state.services[1].id });
    const price = propose(`Set the price of ${state.services[1].name} to 700 SEK`);
    if (price.kind !== "change") throw new Error("expected a price change");
    expect(reduce(state, price.action).services[1].price).toBe(700);
  });

  it("matches stock by product words", () => {
    const proposal = propose("Order more urea foot cream");
    if (proposal.kind !== "change" || proposal.action.type !== "stock/order") throw new Error("expected an order");
    expect(proposal.action.lines[0].id).toBe("urea-cream");
    expect(propose("Order moonbeams").kind).toBe("message");
  });

  it("opens the campaign studio for poster and campaign requests", () => {
    expect(propose("Make a poster for Christmas")).toMatchObject({ kind: "message", link: { href: expect.stringContaining("/studio/more/campaigns/new?holiday=christmas") } });
    expect(propose("Make a Father's Day campaign")).toMatchObject({ kind: "message", link: { href: expect.stringContaining("holiday=father-s-day") } });
    expect(propose("20% off massage all of March")).toMatchObject({ kind: "message", link: { href: expect.stringContaining("percent=20") } });
  });
});

describe("clarifying questions", () => {
  it("offers every service when the treatment is missing", () => {
    const text = "Book " + fullName(owner) + " tomorrow at 10:00";
    const question = interpretCommand(text, context);
    expect(question.action).toBe("question");
    const choices = clarifyChoices((question as { question: string }).question, text, state, today, examples);
    expect(choices).toHaveLength(state.services.length);
    const retried = interpretCommand(choices[0].text, context);
    expect(retried.action).toBe("book");
  });

  it("lists the matching customers when a name is ambiguous", () => {
    const counts = new Map<string, number>();
    for (const c of state.customers) counts.set(c.firstName, (counts.get(c.firstName) ?? 0) + 1);
    const first = [...counts].find(([, n]) => n > 1)![0];
    const text = `Book ${first} for ${state.services[1].name} tomorrow at 10:00`;
    const question = interpretCommand(text, context);
    expect(question.action).toBe("question");
    const choices = clarifyChoices((question as { question: string }).question, text, state, today, examples);
    expect(choices.length).toBeGreaterThan(1);
    const picked = choices[0];
    expect(picked.text).toContain(picked.label);
    const retried = interpretCommand(picked.text, context);
    expect(retried.action).toBe("book");
    expect(state.customers.find((c) => c.id === retried.params.customerId)).toBeDefined();
  });

  it("offers days, day parts and discounts for the matching questions", () => {
    expect(clarifyChoices("Which day should I book?", "book x", state, today, examples).map((c) => c.label).slice(0, 2)).toEqual(["Today", "Tomorrow"]);
    expect(clarifyChoices("What time or part of the day suits you?", "book x", state, today, examples)[0].text).toBe("book x in the morning");
    expect(clarifyChoices("What discount or price should I use?", "offer foot", state, today, examples)[0].text).toBe("offer foot 10% off");
    expect(clarifyChoices("Who should I book? Please give the customer's name.", "book", state, today, examples)).toEqual([]);
  });

  it("falls back to example prompts for vague commands", () => {
    const text = "hello";
    const question = interpretCommand(text, context) as { question: string };
    expect(clarifyChoices(question.question, text, state, today, examples).map((c) => c.text)).toEqual(examples);
  });
});

describe("example prompts", () => {
  it("are understood by the interpreter", () => {
    expect(examples).toHaveLength(3);
    for (const example of examples) expect(interpretCommand(example, context).action).not.toBe("question");
  });
});
