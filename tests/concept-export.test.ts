import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { bookingsCsv, customersCsv, toCsv } from "@/concept/studio/more/export";

describe("concept data export", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", 3]])).toBe('a,"say ""hi""","x,y",3');
  });

  it("exports one row per customer and booking plus a header", () => {
    const state = createDemoState("2026-11-16");
    expect(customersCsv(state).split("\n")).toHaveLength(state.customers.length + 1);
    expect(bookingsCsv(state).split("\n")[0]).toBe("id,date,time,minutes,customer_id,service,staff,price_sek,status");
  });
});
