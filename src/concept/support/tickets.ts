import type { LogActor, LogEntry } from "../log/types";

export const TICKET_ACTIVITY = 20;

/** The last few things that happened, as shown to support (no before/after, no undo data). */
export interface TicketActivity {
  at: number;
  actor: LogActor;
  summary: string;
}

/** A help request the assistant could not answer. Demo only: it stays in this browser. */
export interface Ticket {
  id: string;
  createdAt: number;
  question: string;
  path: string;
  requestId: string;
  /** Plain-text outline of what was on screen: headings and button labels, no typed text. */
  screen: string[];
  activity: TicketActivity[];
}

export type NewTicket = Omit<Ticket, "id">;

function recentActivity(log: LogEntry[]): TicketActivity[] {
  return log.slice(0, TICKET_ACTIVITY).map(({ at, actor, summary }) => ({ at, actor, summary }));
}

/** A ticket as the Help button sends it: the question, the page, a request id, the screen outline and the latest changes. */
export function buildTicket(input: Pick<Ticket, "question" | "path" | "requestId" | "screen">, log: LogEntry[], at: number): NewTicket {
  return { ...input, question: input.question.trim(), createdAt: at, activity: recentActivity(log) };
}
