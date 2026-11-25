import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { addDays } from "@/concept/data/dates";
import { figuresFromBookings } from "@/concept/finance/figures";
import { t, tc } from "@/concept/i18n";
import { formatMoney, formatTime } from "@/concept/i18n/format";
import { dayBookings, fullName, lowStock } from "@/concept/selectors";
import { dayFacts, eveningRecap, eveningSpeech, summaryDue } from "@/concept/summary/day";
import { EveningSummaryView } from "@/concept/studio/today/evening-summary";

// The evening recap on Today and its read-aloud button. Rules only, fictional data only.
// Tuesday 17 November 2026, after the last booking.

const today = "2026-11-17";
const base = createDemoState(today);
const lastEnd = Math.max(...dayBookings(base, today).map((b) => b.start + b.duration));
const clock = { today, minutes: lastEnd };

describe("evening recap", () => {
  it("is due after the last booking and recaps the day plus tomorrow from rules", () => {
    expect(summaryDue(base, { today, minutes: lastEnd - 1 })).toBe(false);
    expect(summaryDue(base, clock)).toBe(true);
    const recap = eveningRecap(base, clock);
    const figures = figuresFromBookings(base, { start: today, end: addDays(today, 1) }, clock);
    const facts = dayFacts(base, clock);
    const upcoming = dayBookings(base, addDays(today, 1));
    const first = upcoming[0];
    const name = base.customers.find((c) => c.id === first.customerId)!.firstName;
    expect(recap.title).toBe(t("summary.title"));
    expect(recap.summary).toBe(t("summary.revenue", { amount: formatMoney(figures.revenue, base.localization.currency), visits: tc("command.revenue.visits", figures.visits) }));
    expect(recap.highlights[0]).toBe(tc("summary.noShows", facts.noShows));
    expect(recap.highlights[1]).toBe(tc("summary.cancelled", figures.cancelled));
    expect(recap.highlights[2]).toBe(tc("summary.newCustomers", facts.newCustomers));
    expect(recap.highlights[3]).toBe(tc("summary.missingJournals", facts.missingJournals));
    expect(recap.highlights).toContain(tc("summary.tomorrowStarts", upcoming.length, { name, time: formatTime(first.start) }));
  });

  it("names tomorrow's first customer by first name and time, and counts tomorrow's bookings", () => {
    const recap = eveningRecap(base, clock);
    const first = dayBookings(base, addDays(today, 1))[0];
    const customer = base.customers.find((c) => c.id === first.customerId)!;
    const line = recap.highlights.find((item) => item.includes(formatTime(first.start)))!;
    expect(line).toContain(customer.firstName);
    expect(line).toContain(String(dayBookings(base, addDays(today, 1)).length));
    expect(line).not.toContain(customer.lastName);
    const spoken = eveningSpeech(recap);
    expect(spoken).toContain(line);
    expect(spoken.startsWith(`${recap.title}.`)).toBe(true);
    expect(spoken).toContain(recap.summary);
  });

  it("mentions waiting replies and low stock when they are there, and leaves them out when they are not", () => {
    const recap = eveningRecap(base, clock);
    const waiting = base.inbox.filter((item) => !item.handled && (item.kind === "request" || item.kind === "reschedule")).length;
    const stock = lowStock(base).length;
    if (waiting) expect(recap.highlights).toContain(tc("brief.waiting", waiting));
    if (stock) expect(recap.highlights).toContain(tc("summary.lowStock", stock));
    const quiet = eveningRecap({ ...base, inbox: base.inbox.map((item) => ({ ...item, handled: true })), stock: [] }, clock);
    expect(quiet.highlights.some((line) => line === tc("brief.waiting", waiting) || line.includes("running low"))).toBe(false);
  });

  it("says the day is empty tomorrow when nothing is booked", () => {
    const emptyTomorrow = { ...base, bookings: base.bookings.filter((booking) => booking.date !== addDays(today, 1)) };
    const recap = eveningRecap(emptyTomorrow, clock);
    expect(recap.highlights).toContain(t("summary.tomorrowEmpty"));
    expect(eveningSpeech(recap)).toContain(t("summary.tomorrowEmpty"));
  });

  it("never puts last names, contact details, journal text or a person's payment into the recap or the speech", () => {
    const first = dayBookings(base, today)[0];
    const customer = base.customers.find((c) => c.id === first.customerId)!;
    const journaled = reduce(base, { type: "journal/add", entry: { customerId: customer.id, date: today, staffId: "anna", treatment: "Fictional treatment note", observations: "Fictional observation", advice: "Fictional advice" } });
    const recap = eveningRecap(journaled, clock);
    const spoken = eveningSpeech(recap);
    const body = [recap.summary, ...recap.highlights, spoken].join(" ");
    expect(body).not.toContain(customer.lastName);
    expect(body).not.toContain(fullName(customer));
    if (customer.phone) expect(body).not.toContain(customer.phone);
    if (customer.email) expect(body).not.toContain(customer.email);
    expect(body).not.toContain("Fictional");
    expect(body).not.toContain(formatMoney(first.price, base.localization.currency));
    expect(spoken).toContain(formatMoney(figuresFromBookings(journaled, { start: today, end: addDays(today, 1) }, clock).revenue, base.localization.currency));
  });
});

describe("evening summary card", () => {
  const recap = eveningRecap(base, clock);
  const html = (props: Partial<Parameters<typeof EveningSummaryView>[0]>) =>
    renderToStaticMarkup(createElement(EveningSummaryView, { recap, speakable: true, speaking: false, onToggle: () => undefined, ...props }));
  const inHtml = (text: string) => text.replace(/'/g, "&#x27;");

  it("shows the recap with a labelled read-aloud button that becomes a stop button", () => {
    const idle = html({});
    expect(idle).toContain('data-testid="evening-summary"');
    expect(idle).toContain(recap.title);
    expect(idle).toContain(inHtml(recap.summary));
    for (const line of recap.highlights) expect(idle).toContain(inHtml(line));
    expect(idle).toContain(t("brief.readAloud"));
    expect(idle).toContain('aria-pressed="false"');
    const reading = html({ speaking: true });
    expect(reading).toContain(t("brief.stopReading"));
    expect(reading).toContain('aria-pressed="true"');
  });

  it("keeps the text and drops the button where the browser cannot speak", () => {
    const silent = html({ speakable: false });
    expect(silent).not.toContain(t("brief.readAloud"));
    expect(silent).toContain(inHtml(recap.summary));
  });

  it("starts speech only from the button: rendering reads nothing, and the card never calls a model", () => {
    const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] };
    vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: class {} });
    html({});
    expect(synth.speak).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const source = readFileSync(new URL("../src/concept/studio/today/evening-summary.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/runAiTask|isAiConfigured/);
    expect(source.match(/\bspeak\(/g)).toHaveLength(1);
    expect(source).toMatch(/const toggle = useCallback\(\(\) => \{[\s\S]*speak\(eveningSpeech\(recap\)/);
  });
});
