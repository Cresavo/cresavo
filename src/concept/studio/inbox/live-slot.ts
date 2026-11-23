import { addDays } from "../../data/dates";
import { freeStarts, isFree, moveNeed, needOf } from "../../data/slots";
import type { DateKey, DemoState, SlotSuggestion } from "../../data/types";

/** The suggested slot if it is still free, otherwise the next free one for the same treatment. */
export function liveSlot(state: DemoState, slot: SlotSuggestion, today: DateKey, minutes: number, ignoreId?: string): SlotSuggestion | undefined {
  const service = state.services.find((s) => s.id === slot.serviceId);
  if (!service) return undefined;
  const need = moveNeed(state, ignoreId, needOf(service));
  const future = slot.date > today || (slot.date === today && slot.start > minutes);
  if (future && isFree(state, slot.staffId, slot.date, slot.start, need, ignoreId)) return slot;
  const first = slot.date < today ? today : slot.date;
  for (let i = 0; i < 14; i++) {
    const date = addDays(first, i);
    const [start] = freeStarts(state, slot.staffId, date, need, { after: date === today ? minutes : 0, ignoreId });
    if (start !== undefined) return { ...slot, date, start };
  }
  return undefined;
}
