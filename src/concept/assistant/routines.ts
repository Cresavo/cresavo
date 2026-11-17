import { addDays, formatTime, weekday } from "../data/dates";
import type { DateKey, DemoState } from "../data/types";
import type { Clock } from "../finance/types";
import { t, tc, words } from "../i18n";
import { buildCustomerStats, lowStock } from "../selectors";
import { dueBackList } from "../customers/return-visits";

// Routines are small skills, written like an agentskills.io SKILL.md: a name,
// when it runs, its steps and the tools it may use. The assistant suggests one
// when it sees a pattern; the owner switches it on, and on its schedule it
// leaves a proposal in the assistant panel. It never changes anything itself.

export type RoutineId = "monday-reminders" | "friday-stock";

export interface Routine {
  id: RoutineId;
  name: string;
  description: string;
  /** Weekdays (0 = Sunday) and the time of day it runs. */
  when: { weekdays: number[]; time: string };
  steps: string[];
  /** Tool names from the shared registry (`src/concept/tools`). */
  tools: string[];
  enabled: boolean;
  createdOn: DateKey;
  /** The last scheduled run that was handled ("YYYY-MM-DD HH:MM"), or the moment it was switched on. */
  lastRun: string;
}

/** A routine the assistant proposes, and why. */
export interface RoutineSuggestion {
  routine: Routine;
  reason: string;
}

const RECENT_DAYS = 28;
const MIN_REPEATS = 2;
const MIN_OVERDUE = 3;

function template(id: RoutineId, today: DateKey, lastRun: string): Routine {
  const base = { id, enabled: true, createdOn: today, lastRun };
  if (id === "monday-reminders") {
    return {
      ...base,
      name: t("routine.reminders.name"),
      description: t("routine.reminders.description"),
      when: { weekdays: [1], time: "08:00" },
      steps: [t("routine.reminders.step1"), t("routine.reminders.step2"), t("routine.reminders.step3")],
      tools: ["list_customers", "get_availability"],
    };
  }
  return {
    ...base,
    name: t("routine.stock.name"),
    description: t("routine.stock.description"),
    when: { weekdays: [5], time: "09:00" },
    steps: [t("routine.stock.step1"), t("routine.stock.step2"), t("routine.stock.step3")],
    tools: ["get_stock", "propose_stock_order"],
  };
}

/** "YYYY-MM-DD HH:MM": sorts in time order as text. */
export const slotKey = (date: DateKey, minutes: number) => `${date} ${formatTime(minutes)}`;

/** A ready routine record for a template, switched on from now. */
export function newRoutine(id: RoutineId, clock: Clock): Routine {
  return template(id, clock.today, slotKey(clock.today, clock.minutes));
}

/** Routines worth suggesting now: a pattern in what the owner does, or in the data, that a routine would take care of. */
export function suggestedRoutines(state: DemoState, clock: Clock): RoutineSuggestion[] {
  const kept = new Set(state.routines.map((r) => r.id));
  const dismissed = (id: RoutineId) => state.dismissedCards.includes(`routine-${id}`);
  const suggestions: RoutineSuggestion[] = [];
  const since = addDays(clock.today, -RECENT_DAYS);
  const sentReminders = state.inbox.filter((i) => i.recallServiceId && i.date >= since).length;
  const overdue = dueBackList(state, buildCustomerStats(state, clock.today), clock.today).length;
  if (!kept.has("monday-reminders") && !dismissed("monday-reminders") && (sentReminders >= MIN_REPEATS || overdue >= MIN_OVERDUE)) {
    suggestions.push({
      routine: newRoutine("monday-reminders", clock),
      reason: sentReminders >= MIN_REPEATS ? tc("routine.reminders.reasonSent", sentReminders) : tc("routine.reminders.reasonOverdue", overdue),
    });
  }
  const low = state.modules.stock ? lowStock(state).length : 0;
  if (!kept.has("friday-stock") && !dismissed("friday-stock") && low > 0) {
    suggestions.push({ routine: newRoutine("friday-stock", clock), reason: tc("routine.stock.reason", low) });
  }
  return suggestions;
}

/** The latest scheduled run at or before now (looking back up to a week), as a slot key. */
export function latestSlot(routine: Pick<Routine, "when">, clock: Clock): string | null {
  const time = Number(routine.when.time.slice(0, 2)) * 60 + Number(routine.when.time.slice(3));
  for (let back = 0; back <= 7; back++) {
    const date = addDays(clock.today, -back);
    if (routine.when.weekdays.includes(weekday(date)) && (back > 0 || time <= clock.minutes)) return slotKey(date, time);
  }
  return null;
}

/** The scheduled run that is due now and not handled yet, if any. */
export function dueRun(routine: Routine, clock: Clock): string | null {
  if (!routine.enabled) return null;
  const slot = latestSlot(routine, clock);
  return slot && slot > routine.lastRun ? slot : null;
}

/** "Mondays at 08:00". */
export function scheduleText(routine: Pick<Routine, "when">): string {
  const days = routine.when.weekdays.map((day) => words.weekdays[day]).join(", ");
  return t("routine.schedule", { days, time: routine.when.time });
}

/** The routine as a SKILL.md file, the format agent skills are shared in. */
export function toSkillMd(routine: Routine): string {
  return [
    "---",
    `name: ${routine.id}`,
    `description: ${routine.description}`,
    `when: ${scheduleText(routine)}`,
    `tools: ${routine.tools.join(", ")}`,
    `enabled: ${routine.enabled}`,
    "---",
    "",
    `# ${routine.name}`,
    "",
    ...routine.steps.map((step, i) => `${i + 1}. ${step}`),
    "",
  ].join("\n");
}
