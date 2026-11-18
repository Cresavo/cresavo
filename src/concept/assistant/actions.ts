import { sendDemoMessage } from "../connections/demo";
import type { DateKey, DemoState } from "../data/types";
import { alreadyRemembered, memoryRejection, type NewMemory } from "./memory";
import type { Routine } from "./routines";

// Store actions for the assistant's memory, routines and the texts it drafts.
// The memory filter runs here too, so nothing the filter rejects is ever
// saved, whichever screen or agent asked.

/** A simulated text to one customer. It lands in the inbox; nothing leaves the demo. */
export interface OutgoingText {
  customerId: string;
  title: string;
  body: string;
  /** Set when the text suggests a return visit for this treatment. */
  recallServiceId?: string;
}

export type AssistantAction =
  | { type: "memory/add"; item: NewMemory }
  | { type: "memory/edit"; id: string; text: string }
  | { type: "memory/forget"; id: string }
  | { type: "routine/add"; routine: Routine }
  | { type: "routine/toggle"; id: string; at: string }
  | { type: "routine/ran"; id: string; at: string }
  | { type: "customers/message"; texts: OutgoingText[]; at: { date: DateKey; time: number } };

export function applyAssistant(state: DemoState, action: AssistantAction): DemoState {
  switch (action.type) {
    case "memory/add": {
      const text = action.item.text.trim();
      if (memoryRejection(text, state) || alreadyRemembered(state.memory, text)) return state;
      return { ...state, seq: state.seq + 1, memory: [{ ...action.item, text, id: `m-${state.seq}` }, ...state.memory] };
    }
    case "memory/edit": {
      const text = action.text.trim();
      const item = state.memory.find((m) => m.id === action.id);
      if (!item || item.text === text || memoryRejection(text, state)) return state;
      return { ...state, memory: state.memory.map((m) => (m.id === action.id ? { ...m, text } : m)) };
    }
    case "memory/forget":
      return state.memory.some((m) => m.id === action.id) ? { ...state, memory: state.memory.filter((m) => m.id !== action.id) } : state;
    case "routine/add":
      return state.routines.some((r) => r.id === action.routine.id) ? state : { ...state, routines: [...state.routines, action.routine] };
    case "routine/toggle":
      return {
        ...state,
        // Switching on starts from now, so a run that was missed while off is not replayed.
        routines: state.routines.map((r) => (r.id === action.id ? { ...r, enabled: !r.enabled, lastRun: r.enabled ? r.lastRun : action.at } : r)),
      };
    case "routine/ran":
      return { ...state, routines: state.routines.map((r) => (r.id === action.id && action.at > r.lastRun ? { ...r, lastRun: action.at } : r)) };
    case "customers/message": {
      // Each text goes through the SMS port (simulated); one the port refuses is not shown as sent.
      const known = action.texts.filter((text) => state.customers.some((c) => c.id === text.customerId) &&
        sendDemoMessage({ channel: "sms", to: { customerId: text.customerId }, body: text.body, reference: `assistant-${text.customerId}-${action.at.date}-${action.at.time}` }));
      if (!known.length) return state;
      const items = known.map((text, i) => ({
        id: `i-${state.seq + i}`,
        kind: "system" as const,
        customerId: text.customerId,
        recallServiceId: text.recallServiceId,
        date: action.at.date,
        time: action.at.time,
        title: text.title,
        body: text.body,
        read: false,
        handled: true,
      }));
      return { ...state, seq: state.seq + known.length, inbox: [...items, ...state.inbox] };
    }
  }
}
