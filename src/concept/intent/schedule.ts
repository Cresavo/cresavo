import { translate } from "../i18n";
import { parseDate } from "./dates";
import { matchNames } from "./match";
import type { IntentContext, IntentParams, IntentResult, QuestionKey, TimeOffReason } from "./types";

// Commands about the plan rather than a booking: someone is off, the salon is
// closed, someone works an extra shift.

const CLOCK = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?";
const RANGE = new RegExp(`${CLOCK}\\s*(?:-|–|—|to|until|till)\\s*${CLOCK}`);

function hhmm(hour: string, minute: string | undefined, meridiem: string | undefined): string | undefined {
  let h = Number(hour);
  const m = Number(minute ?? 0);
  if (meridiem) {
    if (h < 1 || h > 12) return undefined;
    h = (h % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (h > 23 || m > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function reasonOf(text: string): TimeOffReason {
  if (/\b(sick|ill)\b/.test(text)) return "sick";
  if (/\b(holiday|vacation)\b/.test(text)) return "vacation";
  return "other";
}

/** The schedule intent in the text, or undefined when the text is about something else. */
export function interpretSchedule(text: string, context: IntentContext): IntentResult | undefined {
  if (/\b(move|reschedule|rebook|cancel|book)\b|%/.test(text)) return undefined;
  const params: IntentParams = {};
  const ask = (key: QuestionKey, name?: string): IntentResult => {
    const question = translate("en", key, name === undefined ? undefined : { name });
    return { action: "question", params, summary: question, question, confidence: 0 };
  };
  const done = (action: "staff-off" | "close-salon" | "staff-shift", summary: string): IntentResult => ({ action, params, summary, confidence: 0.9 });

  if (/\b(close|closed|shut)\b/.test(text) && /\b(salon|shop|studio|clinic|business|we|us)\b/.test(text)) {
    params.date = parseDate(text, context);
    if (!params.date) return ask("command.question.closeDay");
    return done("close-salon", `Propose closing the salon on ${params.date}.`);
  }

  const off = /\b(off|away|absent|sick|ill|on (?:holiday|vacation|leave))\b/.test(text);
  const works = /\b(works?|working|shift)\b/.test(text);
  if (!off && !works) return undefined;
  const people = matchNames(text, context.staff);
  if (people.length !== 1) return people.length ? ask("command.question.staff") : undefined;
  params.staffId = people[0].id;
  params.date = parseDate(text, context);
  if (off) {
    if (!params.date) return ask("command.question.offDay", people[0].name);
    params.reason = reasonOf(text);
    return done("staff-off", `Propose marking ${people[0].name} as off on ${params.date}.`);
  }
  if (!params.date) return ask("command.question.shiftDay", people[0].name);
  const range = text.match(RANGE);
  const start = range && hhmm(range[1], range[2], range[3]);
  const end = range && hhmm(range[4], range[5], range[6]);
  if (!start || !end || start >= end) return ask("command.question.shiftHours", people[0].name);
  params.time = start;
  params.endTime = end;
  return done("staff-shift", `Propose ${people[0].name} working ${params.date} ${start}-${end}.`);
}
