type Card = { id: string; top: number; height: number };
export type CardPlacement = Card & { column: number; columns: number };

// Presentation only, for ONE staff member on ONE day. Minimum-size hit targets
// can collide even when real appointment times do not. Split those targets into
// columns without moving their time or letting a hover steal a neighbour's click.
export function layoutCalendarCards(cards: readonly Card[]) {
  const result = new Map<string, CardPlacement>();
  let group: CardPlacement[] = [];
  let ends: number[] = [];
  let groupEnd = -Infinity;
  function flush() {
    for (const card of group) {
      card.columns = ends.length;
      result.set(card.id, card);
    }
    group = [];
    ends = [];
  }
  for (const input of [...cards].sort(
    (a, b) => a.top - b.top || a.id.localeCompare(b.id),
  )) {
    const height = Math.max(24, input.height);
    if (input.top >= groupEnd) flush();
    let column = ends.findIndex((end) => end <= input.top);
    if (column === -1) column = ends.length;
    ends[column] = input.top + height;
    groupEnd = Math.max(...ends);
    group.push({ ...input, height, column, columns: 1 });
  }
  flush();
  return result;
}
