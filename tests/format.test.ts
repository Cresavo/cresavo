import { expect, it } from "vitest";
import { formatBookingTime } from "../src/lib/format";

it.each([
  ["2027-03-26T08:00:00Z", "26/03/2027", "2027-03-26"],
  ["2027-03-29T07:00:00Z", "29/03/2027", "2027-03-29"],
  ["2027-11-01T08:00:00Z", "01/11/2027", "2027-11-01"],
])(
  "shared web and MCP formatting shows 09:00 Stockholm time for %s",
  (instant, englishDate, swedishDate) => {
    expect(formatBookingTime(instant)).toBe(`${englishDate}, 09:00`);
    expect(formatBookingTime(instant, "sv")).toBe(`${swedishDate} 09:00`);
  },
);
