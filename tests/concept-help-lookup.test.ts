import { describe, expect, it } from "vitest";
import { findHelp, helpWords, wordMatch } from "@/concept/help/map/lookup";

describe("help lookup words", () => {
  it("drops stop words in both languages and ignores accents and case", () => {
    expect(helpWords("Hur flyttar jag en bokning?")).toEqual(["flyttar", "bokning"]);
    expect(helpWords("How do I change OPENING hours")).toEqual(["change", "opening", "hours"]);
    expect(helpWords("Var återställer jag demon?")).toEqual(["aterstaller", "demon"]);
  });

  it("keeps a Swedish particle verb whole", () => {
    expect(helpWords("boka om en tid")).toEqual(["omboka", "tid"]);
  });

  it("matches stems and forgives a typo", () => {
    expect(wordMatch("flyttar", "flytta")).toBeGreaterThan(0);
    expect(wordMatch("bokningslanken", "bokningslank")).toBeGreaterThan(0);
    expect(wordMatch("oppetider", "oppettider")).toBeGreaterThan(0);
    expect(wordMatch("bok", "boka")).toBe(0);
  });
});

describe("findHelp", () => {
  it.each([
    ["hur flyttar jag en bokning?", "booking.move"],
    ["var återställer jag demon?", "advanced.reset-demo"],
    ["how do I change opening hours", "hours.weekly"],
    ["lägga till en behandling", "services.add"],
    ["ta betalt", "booking.take-payment"],
    ["dela bokningslänken", "link.copy"],
    ["importera kunder", "customers.import"],
    ["koppla Claude", "developers.connect"],
    ["boka om en tid", "booking.move"],
    ["ändra tid på en bokning", "booking.move"],
    ["How do I reschedule an appointment?", "booking.move"],
    ["how do I add a new treatment", "services.add"],
    ["change the price of a treatment", "services.treatment"],
    ["dark mode", "shell.theme"],
    ["mörkt läge", "shell.theme"],
    ["where do I reset the demo", "advanced.reset-demo"],
    ["share my booking link", "link.copy"],
    ["ändra öppetider", "hours.weekly"],
    ["cancel a booking", "booking.cancel"],
    ["lägga in semester", "staff.time-off"],
    ["få tillbaka en borttagen kund", "log.trash"],
    ["exportera mina uppgifter", "data.download"],
    ["how do I undo a change", "help.history"],
    ["skicka ett svar till kunden", "inbox.reply"],
    ["Visa mig hur jag tar betalt", "booking.take-payment"],
    ["book a customer", "calendar.new-booking"],
    ["stäng salongen en dag", "hours.closed-days"],
    ["connect ChatGPT", "developers.connect"],
  ])("%s → %s", (question, id) => {
    expect(findHelp(question).best?.id).toBe(id);
  });

  it("finds nothing for words the studio does not have", () => {
    expect(findHelp("xyzzy blorp")).toEqual({ best: null, alternatives: [], ambiguous: false });
    expect(findHelp("hur gör jag?").best).toBeNull();
    // "ställer" is in a caption ("Ställer tillbaka demon"), which alone is not a match.
    expect(findHelp("var ställer jag in pizzaugnen?").best).toBeNull();
  });

  it("offers a few alternatives, never the best one twice", () => {
    const { best, alternatives } = findHelp("booking");
    expect(best).not.toBeNull();
    expect(alternatives.length).toBeLessThanOrEqual(3);
    expect(alternatives.map((entry) => entry.id)).not.toContain(best?.id);
  });

  it("calls a vague question ambiguous", () => {
    expect(findHelp("bokning").ambiguous).toBe(true);
  });
});
