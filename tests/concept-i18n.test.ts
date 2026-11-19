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
import { buildIntentContext } from "@/concept/command/intent-context";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, setVocabulary, t, tc, term } from "@/concept/i18n";
import { en } from "@/concept/i18n/en";
import { formatDayLong, formatMoney, formatNumber, formatTime, setCurrency } from "@/concept/i18n/format";
import { salonCopy, studioSalonCopy } from "@/concept/i18n/salon-eko-copy";
import { sv } from "@/concept/i18n/sv";
import { interpretCommand } from "@/concept/intent";
import { getPack } from "@/concept/packs";
import { fullName } from "@/concept/selectors";

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
    expect(formatMoney(795.55)).toBe("795,55\u00a0kr");
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
    expect(swedish.body).toBe(`${swedish.details} Se din bokning, boka om eller avboka här: ${swedish.path}`);
    setLocale("sv");
    const reminder = bookingMessage(base, booking, "reminder");
    expect(reminder.subject).toBe("Your visit · Salong Eko");
    expect(reminder.details).toContain("1 Dec 2026 at 10:00");
    expect(reminder.body).toBe(`${reminder.details} Manage your booking: ${reminder.path}`);
    expect(t("nav.today")).toBe("Idag");
  });

  it("includes the full date, local time and salon zone in both deadline translations", () => {
    const slot = { date: "2027-01-01", start: 855 };
    expect(freeUntilText(slot, 24, Date.parse("2026-12-30T00:00Z"))).toContain("31 Dec 2026 at 14:15 (Europe/Stockholm)");
    setLocale("sv");
    expect(freeUntilText(slot, 24, Date.parse("2026-12-30T00:00Z"))).toContain("31 december 2026 kl. 14:15 (Europe/Stockholm)");
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

  it("presents untouched demo fixtures in each view language and preserves edits and identifiers", () => {
    const edited = {
      ...base,
      services: base.services.map((s) => s.id === "basic-foot-care" ? { ...s, name: "My foot treatment" } : s),
      reviews: [...base.reviews, { ...base.reviews[0], id: "user-review", text: "My own review" }],
    };
    const studio = studioSalonCopy(edited, "sv");
    const booking = salonCopy(edited, "en");
    expect(studio.services.find(({ id }) => id === "medical-foot-care")).toMatchObject({
      name: "Medicinsk fotvård", description: expect.stringContaining("Nagelklippning"),
    });
    expect(studio.services.find(({ id }) => id === "basic-foot-care")).toMatchObject({
      name: "My foot treatment", description: expect.stringContaining("Nagelvård"),
    });
    expect(studio.categories[0]).toMatchObject({ id: "foot", name: "Fotvård" });
    expect(studio.staff[0]).toMatchObject({ id: "anna", title: "Medicinsk fotterapeut", bio: expect.stringContaining("Öppnade Salong Eko") });
    expect(studio.reviews.find(({ id }) => id === "r-ny-1")?.text).toContain("Så lugnt");
    expect(studio.reviews.at(-1)?.text).toBe("My own review");
    expect(studio.inbox.find(({ id }) => id === "i-presentkort")).toMatchObject({
      title: "Fråga om presentkort", body: expect.stringContaining("Säljer ni presentkort?"),
      draftReply: expect.stringContaining("gift cards"),
    });
    expect(booking.services[0].name).toBe("Medical foot care");
    expect(booking.reviews[0].text).toBe(base.reviews[0].text);
    expect(salonCopy(studio, "en").services[0].name).toBe("Medical foot care");
    expect(base.services[0].name).toBe("Medical foot care");

    const swedishBusiness = { ...base, localization: { ...base.localization, language: "sv" as const } };
    expect(studioSalonCopy(swedishBusiness, "en").inbox.find(({ id }) => id === "i-presentkort"))
      .toMatchObject({ title: "Question about gift cards", draftReply: expect.stringContaining("Vi har presentkort") });
    expect(salonCopy(swedishBusiness, "sv").reviews[0].text).toBe(studio.reviews[0].text);
  });

  it.each([
    ["Kan du höja priset på medicinsk fotvård till 850 kronor?", "medical-foot-care", 850],
    ["Sänk djupgående massage till 849,50 kr", "deep-tissue", 849.5],
    ["Sätt priset för spafotvård till 1 050 kr", "spa-foot-care", 1050],
    ["Priset för klassisk massage 30 min ska vara 520", "classic-30", 520],
  ])("reads the Swedish price change %s", (text, serviceId, priceSek) => {
    const context = buildIntentContext(base, day, 600);
    expect(interpretCommand(text, context)).toMatchObject({ action: "change-price", params: { serviceId, priceSek } });
  });

  it("uses existing proposal cards for Swedish stock, campaign and booking-page requests", () => {
    setLocale("sv");
    const ask = (text: string, role: "owner" | "staff" = "owner") =>
      respond({ state: studioSalonCopy(base, "sv"), text, clock: { today: day, minutes: 600 }, role, context: emptyContext(), examples: [] }).reply;
    expect(ask("Hur mycket har vi kvar av den oparfymerade massageoljan?").card).toMatchObject({
      kind: "stock", items: [expect.objectContaining({ id: "massage-oil-neutral" })],
    });
    expect(ask("Kan du lägga en beställning på huddesinfektion?").card).toMatchObject({
      kind: "change", action: { type: "stock/order", orders: [expect.objectContaining({ supplier: "Medicinab" })] },
    });
    expect(ask("Hur mycket kostar klassisk massage 30 min?").text).toContain("495");
    expect(ask("Ge 20 procent rabatt på fotvård hela mars").card).toMatchObject({
      kind: "message", link: { href: expect.stringContaining("percent=20") },
    });
    expect(ask("Gör en kampanj inför jul").card).toMatchObject({
      kind: "message", link: { href: expect.stringContaining("holiday=") },
    });
    expect(ask("Kan du göra bokningssidan lugnare och lite lyxigare?").card).toMatchObject({
      kind: "change", action: { type: "page/set", page: { theme: { fonts: "elegant" } } },
    });
    const reordered = ask("Flytta omdömena högst upp").card;
    expect(reordered).toMatchObject({ kind: "change", action: { type: "page/set" } });
    if (reordered?.kind === "change" && reordered.action.type === "page/set") {
      expect(reordered.action.page.sections[1].kind).toBe("reviews");
    }
    expect(ask("Lägg till ett galleri").card).toMatchObject({
      kind: "change", action: { type: "page/set", page: { sections: expect.arrayContaining([expect.objectContaining({ kind: "gallery" })]) } },
    });
    expect(ask("Använd färgerna från vår logga").card).toMatchObject({ kind: "message", link: { href: "/studio/more/booking-page" } });
    expect(ask("Fyll på med huddesinfektion").card).toMatchObject({ kind: "change", action: { type: "stock/order" } });
    expect(ask("Fyll på med huddesinfektion", "staff").text).toBe(t("command.ownerOnly"));
  });

  it.each([
    ["en", "Who should I book? Please give the client's name.", "Which session should I book?", "Which day is Anna off?"],
    ["sv", "Vem vill du boka in? Skriv klientens namn.", "Vilken session vill du boka?", "Vilken dag är Anna ledig?"],
  ] as const)("uses industry terms in %s clarification questions", (language, who, service, schedule) => {
    const state = createDemoState(day, { pack: "trainer" });
    const name = fullName(state.customers[0]);
    setLocale(language);
    setVocabulary(getPack(state.pack).vocabulary);
    const ask = (text: string) => respond({ state, text, clock: { today: day, minutes: 600 }, role: "owner", context: emptyContext(), examples: [] }).reply;

    expect(ask("Book tomorrow").text).toBe(who);
    expect(ask(`Book ${name} tomorrow`).card).toMatchObject({ kind: "choose", title: service, choices: expect.arrayContaining([{ label: state.services[0].name, text: expect.any(String) }]) });
    expect(ask("Anna is off").text).toBe(schedule);
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
  "emptyText", "hint", "label", "placeholder", "subtitle", "text", "title",
]);

function studioLiterals(file: string, content: string): string[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];
  function check(node: ts.Node, value: string) {
    if (!/\p{L}/u.test(value)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push(`${file}:${line + 1} ${value.trim()}`);
  }
  function rendered(node: ts.Expression, allowMessageKey = false) {
    if (ts.isStringLiteralLike(node) && !(allowMessageKey && Object.hasOwn(en.messages, node.text))) check(node, node.text);
    if (ts.isTemplateExpression(node)) {
      check(node.head, node.head.text);
      for (const span of node.templateSpans) {
        check(span.literal, span.literal.text);
        rendered(span.expression, allowMessageKey);
      }
    }
    if (ts.isParenthesizedExpression(node)) rendered(node.expression, allowMessageKey);
    if (ts.isConditionalExpression(node)) {
      rendered(node.whenTrue, allowMessageKey);
      rendered(node.whenFalse, allowMessageKey);
    }
    if (ts.isBinaryExpression(node)) {
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) rendered(node.left, allowMessageKey);
      if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) rendered(node.right, allowMessageKey);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) check(node, node.text);
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) rendered(node.expression);
    if (ts.isJsxAttribute(node) && node.initializer && textAttributes.has(node.name.getText(source))) {
      if (ts.isStringLiteral(node.initializer)) rendered(node.initializer);
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) rendered(node.initializer.expression);
    }
    if (ts.isPropertyAssignment(node) && textAttributes.has(node.name.getText(source))) rendered(node.initializer, true);
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const index = name === "dispatchWithUndoToast" ? 1 : ["showToast", "showUndoToast", "window.alert", "window.confirm"].includes(name) ? 0 : -1;
      if (index >= 0 && node.arguments[index]) rendered(node.arguments[index]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

it("gets studio JSX copy, accessible labels and toast strings from the dictionary", () => {
  const roots = ["src/app/studio", "src/concept/studio", "src/concept/ui", "src/concept/command"];
  const findings = roots.flatMap((dir) => readdirSync(dir, { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".tsx"))
    .flatMap((file) => {
      const path = join(dir, file);
      return studioLiterals(path, readFileSync(path, "utf8"));
    }));
  expect(findings).toEqual([]);
});

it("flags literals in studio option labels and undo notifications", () => {
  expect(studioLiterals("sample.tsx", `
    const options = [{ value: "internal-id", label: "Visible option" }, { label: "common.save" }];
    dispatchWithUndoToast(action, "Saved the booking");
    <Button aria-label={t("common.save")}>{t("common.save")}</Button>;
  `)).toEqual([
    "sample.tsx:2 Visible option",
    "sample.tsx:3 Saved the booking",
  ]);
});
