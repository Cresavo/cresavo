import { addDays, fromKey } from "../data/dates";
import type { DateKey, DemoState } from "../data/types";
import { t, words } from "../i18n";
import { fullName } from "../selectors";
import { matchNames, normalize } from "../intent/match";

/** A tappable answer to a clarifying question: the command to run again with the answer added. */
export interface Retry {
  label: string;
  text: string;
}

const MAX_CUSTOMERS = 6;

/** Replace the first word of the command that names the customer with their full name. */
function withFullName(text: string, name: string): string {
  const parts = normalize(name).split(" ");
  let replaced = false;
  return text.replace(/[\p{L}'’-]+/gu, (word) => {
    if (replaced || !parts.includes(normalize(word))) return word;
    replaced = true;
    return name;
  });
}

/**
 * Turns the interpreter's clarifying question into tappable choices. The
 * engine only returns text, so the question is matched by keywords; an
 * unknown question simply has no choices and the owner types an answer.
 */
export function clarifyChoices(question: string, text: string, state: DemoState, today: DateKey, examples: string[]): Retry[] {
  const q = question.toLowerCase();
  const append = (label: string, addition: string): Retry => ({ label, text: `${text.trim()} ${addition}` });
  if (q.includes("which customer")) {
    const candidates = matchNames(text, state.customers.map((c) => ({ id: c.id, name: fullName(c) }))).slice(0, MAX_CUSTOMERS);
    return candidates.map((c) => ({ label: c.name, text: withFullName(text, c.name) }));
  }
  if (/which (treatment|service)/.test(q)) return state.services.map((s) => append(s.name, s.name));
  if (q.includes("which day")) {
    const days = [2, 3, 4].map((offset) => words.weekdays[fromKey(addDays(today, offset)).getDay()]);
    return [
      append(t("date.today"), "today"),
      append(t("date.tomorrow"), "tomorrow"),
      ...days.map((day) => append(day, day.toLowerCase())),
    ];
  }
  if (q.includes("time or part of the day")) {
    return [
      append(t("command.morning"), "in the morning"),
      append(t("command.afternoon"), "in the afternoon"),
      ...["10:00", "13:00", "15:00"].map((time) => append(time, `at ${time}`)),
    ];
  }
  if (q.includes("what discount or price")) return [10, 15, 20].map((percent) => append(t("format.percent", { value: percent }), `${percent}% off`));
  if (q.includes("since what date")) return [3, 6, 12].map((months) => append(t("command.months", { count: months }), `for ${months} months`));
  if (q.includes("could you describe")) return examples.map((example) => ({ label: example, text: example }));
  return [];
}
