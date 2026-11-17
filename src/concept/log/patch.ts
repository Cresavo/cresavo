import type { DemoState } from "../data/types";
import type { CollectionPatch, Item, StatePatch } from "./types";

// Generic before/after diff of the demo state. It covers everything the
// reducer can change, so a new action is undoable without extra code.

/** Lists of records with an id. */
const COLLECTIONS = [
  "customers", "bookings", "journals", "stock", "orders", "sales", "giftCards", "packages", "reviews", "inbox",
  "campaigns", "services", "costs", "trash", "supportGrants", "tickets", "staff", "exceptions", "resources",
  "memory", "routines",
] as const satisfies readonly (keyof DemoState)[];

/** Whole values compared as a unit. */
const VALUES = ["accounting", "modules", "dismissedCards", "salon"] as const satisfies readonly (keyof DemoState)[];

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const list = (state: DemoState, key: string) => (state as unknown as Record<string, Item[]>)[key];

function diffCollection(before: Item[], after: Item[]): CollectionPatch | null {
  const previous = new Map(before.map((item) => [item.id, item]));
  const current = new Map(after.map((item) => [item.id, item]));
  const patch: CollectionPatch = {
    added: after.filter((item) => !previous.has(item.id)).map((item) => item.id),
    changed: after.flatMap((item) => {
      const old = previous.get(item.id);
      return old && !same(old, item) ? [{ before: old, after: item }] : [];
    }),
    removed: before.flatMap((item, index) => (current.has(item.id) ? [] : [{ index, item }])),
  };
  return patch.added.length || patch.changed.length || patch.removed.length ? patch : null;
}

/** What `next` changed compared with `prev`, or null when nothing tracked changed. */
export function diffStates(prev: DemoState, next: DemoState): StatePatch | null {
  const patch: StatePatch = { collections: {}, values: {} };
  for (const key of COLLECTIONS) {
    if (list(prev, key) === list(next, key)) continue;
    const diff = diffCollection(list(prev, key), list(next, key));
    if (diff) patch.collections[key] = diff;
  }
  for (const key of VALUES) {
    if (prev[key] !== next[key] && !same(prev[key], next[key])) patch.values[key] = { before: prev[key], after: next[key] };
  }
  return Object.keys(patch.collections).length || Object.keys(patch.values).length ? patch : null;
}

/** True while the state still looks the way the change left it, so undoing it is safe. */
export function canApplyPatch(state: DemoState, patch: StatePatch): boolean {
  for (const [key, diff] of Object.entries(patch.collections)) {
    const current = new Map(list(state, key).map((item) => [item.id, item]));
    if (!diff.added.every((id) => current.has(id))) return false;
    if (!diff.changed.every(({ after }) => same(current.get(after.id), after))) return false;
    if (diff.removed.some(({ item }) => current.has(item.id))) return false;
  }
  return Object.entries(patch.values).every(([key, { after }]) => same((state as unknown as Record<string, unknown>)[key], after));
}

/** Puts the state back the way it was before the change. */
export function revertPatch(state: DemoState, patch: StatePatch): DemoState {
  const next: Record<string, unknown> = { ...state };
  for (const [key, diff] of Object.entries(patch.collections)) {
    const added = new Set(diff.added);
    const changed = new Map(diff.changed.map(({ before }) => [before.id, before]));
    const items = list(state, key).filter((item) => !added.has(item.id)).map((item) => changed.get(item.id) ?? item);
    for (const { index, item } of [...diff.removed].sort((a, b) => a.index - b.index)) items.splice(Math.min(index, items.length), 0, item);
    next[key] = items;
  }
  for (const [key, { before }] of Object.entries(patch.values)) next[key] = before;
  return next as unknown as DemoState;
}
