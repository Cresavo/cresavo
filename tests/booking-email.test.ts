import { describe, expect, it } from "vitest";
import { confirmationEmail } from "@/concept/booking/confirmation-email";
import { BRAND } from "@/concept/brand";
import { createDemoState } from "@/concept/data/generate";
import type { Booking, DemoState } from "@/concept/data/types";

// The confirmation e-mail: both languages, escaping, the deadline. Fixed dates.

const NOW = new Date("2026-11-16T10:00:00+01:00").getTime();
const LINK = "https://book.example/boka/salong-fiktiv/booking/b-1#t=v1.b-1.1.abc";

function fixture(language: "en" | "sv", over: { salon?: string; treatment?: string; staff?: string } = {}) {
  const base = createDemoState("2026-11-16");
  const service = { ...base.services[0], name: over.treatment ?? base.services[0].name };
  const staff = { ...base.staff[0], firstName: over.staff ?? base.staff[0].firstName };
  const state: DemoState = {
    ...base, services: [service, ...base.services.slice(1)], staff: [staff, ...base.staff.slice(1)],
    salon: { ...base.salon, name: over.salon ?? base.salon.name, phone: "08-555 01 02", address: "Fiktiv gata 1" },
    localization: { ...base.localization, language },
  };
  const booking: Booking = {
    id: "b-1", customerId: "k-1", staffId: staff.id, serviceId: service.id, date: "2026-11-24", start: 600, duration: 60, price: 500,
    status: "booked", source: "online",
    protection: { terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 50000, depositMinor: 0 } },
  };
  return { state, booking };
}

describe("the confirmation e-mail", () => {
  it("renders in English with the details, the deadline and the link", () => {
    const { state, booking } = fixture("en");
    const mail = confirmationEmail(state, booking, "confirmation", LINK, NOW);
    expect(mail.subject).toMatch(/^Booking confirmed: .+ 24 Nov 2026 10:00$/);
    expect(mail.text).toContain("Free cancellation until 23 Nov 2026 at 10:00 (Europe/Stockholm).");
    expect(mail.text).toContain("08-555 01 02");
    expect(mail.text).toContain(`View your booking: ${LINK}`);
    expect(mail.html).toContain(`<a href="${LINK}"`);
    expect(mail.html).toContain('lang="en"');
  });

  it("renders in Swedish", () => {
    const { state, booking } = fixture("sv");
    const mail = confirmationEmail(state, booking, "confirmation", LINK, NOW);
    expect(mail.subject).toMatch(/^Bokning bekräftad: .+ 24 november 2026 10:00$/);
    expect(mail.text).toContain("Kostnadsfri avbokning fram till 23 november 2026 kl. 10:00");
    expect(mail.html).toContain('lang="sv"');
  });

  it("says a cancellation without notes or link, and a move with its new time and the fresh link, in both languages", () => {
    const en = fixture("en");
    const cancelled = confirmationEmail(en.state, { ...en.booking, status: "cancelled" }, "cancellation", undefined, NOW);
    expect(cancelled.subject).toMatch(/^Booking cancelled: .+ 24 Nov 2026 10:00$/);
    expect(cancelled.text).toContain("Your booking is cancelled");
    expect(cancelled.text).not.toContain("call the salon");
    expect(cancelled.text).not.toContain("View your booking");
    const moved = confirmationEmail(en.state, en.booking, "moved", LINK, NOW);
    expect(moved.subject).toMatch(/^Booking moved to 24 Nov 2026 10:00: /);
    expect(moved.text).toContain("Your booking is moved to 24 Nov 2026 at 10:00");
    expect(moved.text).toContain(`View your booking: ${LINK}`);
    const sv = fixture("sv");
    expect(confirmationEmail(sv.state, { ...sv.booking, status: "cancelled" }, "cancellation", undefined, NOW).text).toContain("Din bokning är avbokad");
    expect(confirmationEmail(sv.state, sv.booking, "moved", LINK, NOW).text).toContain("Din bokning är flyttad till 24 november 2026 kl. 10:00");
  });

  it("names the salon and the brand in the footer, and shows a reminder as one", () => {
    const { state, booking } = fixture("en", { salon: "Salong Fiktiv" });
    expect(confirmationEmail(state, booking, "confirmation", LINK, NOW).text).toContain(`Salong Fiktiv manages your booking; ${BRAND.name} processes it on the salon's behalf.`);
    expect(confirmationEmail(state, booking, "reminder", LINK, NOW).subject).toMatch(/^Reminder: /);
  });

  it("leaves out the deadline once it has passed or when there are no terms", () => {
    const { state, booking } = fixture("en");
    expect(confirmationEmail(state, booking, "confirmation", LINK, Date.parse("2026-11-23T12:00:00+01:00")).text).not.toContain("Free cancellation");
    expect(confirmationEmail(state, { ...booking, protection: undefined }, "confirmation", LINK, NOW).text).not.toContain("Free cancellation");
  });

  it("escapes every value in the HTML and has no remote images", () => {
    const evil = "<script>alert(1)</script>";
    const { state, booking } = fixture("en", { salon: evil, treatment: evil, staff: evil });
    const { html } = confirmationEmail(state, booking, "confirmation", LINK, NOW);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/<img|<link|src=|url\(/);
  });

  it("keeps a line break in a name out of the subject", () => {
    const { state, booking } = fixture("en", { treatment: "Foot\r\nBcc: x@example.test" });
    expect(confirmationEmail(state, booking, "confirmation", LINK, NOW).subject).not.toMatch(/[\r\n]/);
  });
});
