import { expect, it } from "vitest";
import { formatBookingTime } from "../src/lib/format";

it.each([
  ["2027-03-26T08:00:00Z", "2027-03-26"],
  ["2027-03-29T07:00:00Z", "2027-03-29"],
  ["2027-11-01T08:00:00Z", "2027-11-01"],
])(
  "gemensam webb-/MCP-formattering visar Stockholm 09:00 för %s",
  (instant, date) => {
    const formatted = formatBookingTime(instant);
    expect(formatted).toContain(date);
    expect(formatted).toContain("09:00");
  },
);
