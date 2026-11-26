import type { DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import type { Clock } from "../finance/types";
import type { StudioStore, TenantId } from "../store/studio-store";
import { salonClock } from "../tools/clock";

// What the receptionist needs from a salon: its latest state and a way to
// commit a change. Both go through `StudioStore`, so a call follows the same
// booking rules as the studio, whichever store the salon lives in.

export interface SalonView {
  state: DemoState;
  clock: Clock;
  /** Epoch milliseconds of the read. */
  instant: number;
}

export type HostCommit = { ok: true; state: DemoState } | { ok: false };

export interface ReceptionistHost {
  read(): Promise<SalonView | null>;
  /** Commits one action as the receptionist. A refused change (slot taken, unknown id) is `ok: false`. */
  commit(action: DemoAction, idempotencyKey?: string): Promise<HostCommit>;
}

export function studioStoreHost(store: StudioStore, tenantId: TenantId, now: () => number): ReceptionistHost {
  return {
    async read() {
      const snapshot = await store.load(tenantId);
      if (!snapshot) return null;
      const instant = now();
      return { state: snapshot.state, clock: salonClock(new Date(instant)), instant };
    },
    async commit(action, idempotencyKey) {
      const result = await store.apply(tenantId, action, { actor: "ai", source: "assistant", at: now() }, { idempotencyKey });
      return result.ok ? { ok: true, state: result.state } : { ok: false };
    },
  };
}
