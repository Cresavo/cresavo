import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { respond } from "@/concept/assistant/engine";
import { emptyContext } from "@/concept/assistant/thread";
import { freeUntilText } from "@/concept/booking/deadline-text";
import { bookingMessage } from "@/concept/booking/messages";
import { parseBookingRequest } from "@/concept/booking/request";
import { applyAction } from "@/concept/log/capture";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, setVocabulary, t, tc, term } from "@/concept/i18n";
import { en } from "@/concept/i18n/en";
import { formatDayLong, formatMoney, formatNumber, formatTime, setCurrency } from "@/concept/i18n/format";
import { sv } from "@/concept/i18n/sv";
import { interpretCommand } from "@/concept/intent";
import { getPack } from "@/concept/packs";

const day = "2026-11-17";
const base = createDemoState(day);
const slots = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

afterEach(() => {
  setLocale("en");
  setCurrency("SEK");
  setVocabulary(getPack("foot-massage").vocabulary);
});

describe("concept languages", () => {
  it("has the same keys and the same placeholders in each plural form", () => {
    const keys = Object.keys(en.messages) as (keyof typeof en.messages)[];
    expect(Object.keys(sv.messages).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(sv.messages[key].trim(), key).not.toBe("");
      expect(sv.messages[key].split("|").map(slots), key).toEqual(en.messages[key].split("|").map(slots));
    }
  });

  it("switches vocabulary, inflection, plurals and display formats with the locale", () => {
    setVocabulary(getPack("trainer").vocabulary);
    setLocale("sv");
    expect(term("customer", { plural: true, capital: true })).toBe("Klienter");
    expect(tc("command.customers.count", 1)).toBe("1 klient");
    expect(tc("command.customers.count", 2)).toBe("2 klienter");
    expect(t("booking.step.treatment")).toBe("Session");
    expect(formatDayLong(day)).toBe("tisdag 17 november");
    expect(formatTime(14 * 60)).toBe("14:00");
    expect(formatNumber(1234.5, 1)).toBe("1\u00a0234,5");
    expect(formatMoney(795)).toBe("795\u00a0kr");
    setCurrency("EUR");
    expect(formatMoney(795)).toBe("795\u00a0€");
    setLocale("en");
    expect(term("customer", { plural: true })).toBe("clients");
  });

  it("uses the business language for new messages independently of the studio", () => {
    const booking = { ...base.bookings.find((b) => b.status === "booked")!, date: "2026-12-01", start: 600 };
    expect(base.localization).toEqual({ language: "en", currency: "SEK", bilingual: true });
    setLocale("en");
    const swedishBusiness = { ...base, localization: { ...base.localization, language: "sv" as const } };
    const swedish = bookingMessage(swedishBusiness, booking, "confirmation");
    expect(swedish.subject).toBe("Bokningsbekräftelse · Salong Eko");
    expect(swedish.details).toContain("1 december 2026 kl. 10:00");
    expect(swedish.details).not.toContain(swedish.path);
    expect(swedish.body).toBe(`${swedish.details} Se, omboka eller avboka din tid här: ${swedish.path}`);
    setLocale("sv");
    const reminder = bookingMessage(base, booking, "reminder");
    expect(reminder.subject).toBe("Your visit · Salong Eko");
    expect(reminder.details).toContain("1 Dec 2026 at 10:00");
    expect(reminder.body).toBe(`${reminder.details} Manage your booking: ${reminder.path}`);
    expect(t("nav.today")).toBe("Idag");
  });

  it("includes the full date, local time and salon zone in both deadline translations", () => {
    const slot = { date: "2027-01-01", start: 855 };
    expect(freeUntilText(slot)).toContain("31 Dec 2026 at 14:15 (Europe/Stockholm)");
    setLocale("sv");
    expect(freeUntilText(slot)).toContain("31 december 2026 kl. 14:15 (Europe/Stockholm)");
  });

  it("keeps the saved booking language independent and makes it undoable", () => {
    const meta = { at: 0, actor: "owner", source: "button" } as const;
    const updated = applyAction(base, { type: "salon/language", language: "sv", bilingual: false }, meta);
    expect(updated.localization).toEqual({ language: "sv", bilingual: false, currency: "SEK" });
    expect(updated.bookings).toBe(base.bookings);
    expect(applyAction(updated, { type: "log/undo", id: updated.log[0].id }, meta).localization).toEqual(base.localization);
  });

  it("reads a Swedish name, original time and destination day with the shared booking rules", () => {
    const context = {
      customers: [{ id: "c-anna", name: "Anna Karlsson" }],
      staff: [],
      services: [],
      bookings: [{ id: "b-anna", customerId: "c-anna", staffId: "anna", serviceId: "foot", start: "2026-11-17T14:00:00+01:00" }],
      now: "2026-11-17T09:00:00+01:00",
    };
    expect(interpretCommand("flytta Annas 14:00 till fredag", context)).toMatchObject({
      action: "move", params: { bookingId: "b-anna", date: "2026-11-20", time: "14:00" },
    });
    expect(interpretCommand("flytta Annas 14:00 till fredag kl. 15.30", context)).toMatchObject({
      action: "move", params: { bookingId: "b-anna", date: "2026-11-20", time: "15:30" },
    });
    expect(interpretCommand("avboka Annas 14:00 idag", context)).toMatchObject({
      action: "cancel", params: { bookingId: "b-anna" },
    });
  });

  it("answers and clarifies in Swedish with the built-in assistant", () => {
    setLocale("sv");
    const ask = (text: string) => respond({ state: base, text, clock: { today: day, minutes: 10 * 60 }, role: "owner", context: emptyContext(), examples: ["Vem kommer härnäst?"] });
    expect(ask("Vilka kommer idag?").reply).toMatchObject({ source: "rules", card: { kind: "bookings" } });
    expect(ask("Avboka Påhittadperson idag kl. 02:00").reply.text).toContain("Jag hittade inte bokningen.");
    expect(ask("Kom ihåg att Anna har ont och svullnad").effects).toEqual([]);
    expect(ask("Hur gick dagen?").reply.card).toMatchObject({ kind: "brief", brief: { items: expect.arrayContaining([expect.objectContaining({ text: expect.stringMatching(/^Dagens intäkter:/) })]) } });
    expect(ask("Hej").reply.text).toContain("Jag förstod inte riktigt");
  });

  it("reads a Swedish request on the booking page", () => {
    expect(parseBookingRequest("Fotvård i övermorgon hos Anna", base, day)).toMatchObject({
      serviceId: "medical-foot-care", staffId: "anna", from: "2026-11-19", to: "2026-11-19", soonest: false,
    });
    expect(parseBookingRequest("Fotvård imorgon hos Anna", base, day).serviceCandidates).toContain("medical-foot-care");
  });
});

const textAttributes = new Set([
  "alt", "aria-label", "aria-description", "aria-valuetext", "caption", "description",
  "emptyText", "label", "placeholder", "subtitle", "text", "title",
]);

function studioLiterals(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];
  function check(node: ts.Node, value: string) {
    if (!/\p{L}/u.test(value)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push(`${file}:${line + 1} ${value.trim()}`);
  }
  function rendered(node: ts.Expression) {
    if (ts.isStringLiteralLike(node)) check(node, node.text);
    if (ts.isTemplateExpression(node)) {
      check(node.head, node.head.text);
      for (const span of node.templateSpans) {
        check(span.literal, span.literal.text);
        rendered(span.expression);
      }
    }
    if (ts.isParenthesizedExpression(node)) rendered(node.expression);
    if (ts.isConditionalExpression(node)) {
      rendered(node.whenTrue);
      rendered(node.whenFalse);
    }
    if (ts.isBinaryExpression(node)) {
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) rendered(node.left);
      if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) rendered(node.right);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) check(node, node.text);
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) rendered(node.expression);
    if (ts.isJsxAttribute(node) && node.initializer && textAttributes.has(node.name.getText(source))) {
      if (ts.isStringLiteral(node.initializer)) rendered(node.initializer);
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) rendered(node.initializer.expression);
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "showToast" && node.arguments[0]) rendered(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

it("gets studio JSX copy, accessible labels and toast strings from the dictionary", () => {
  const roots = ["src/app/studio", "src/concept/studio", "src/concept/ui", "src/concept/command"];
  const findings = roots.flatMap((dir) => readdirSync(dir, { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".tsx"))
    .flatMap((file) => studioLiterals(join(dir, file))));
  expect(findings).toEqual([]);
});
