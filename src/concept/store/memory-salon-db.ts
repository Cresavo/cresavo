import {
  callEach,
  changesOf,
  errorReporter,
  runChange,
  type SalonChange,
  type SalonDb,
  type SalonRecord,
  type SalonScope,
  type SalonTx,
  type Workspace,
  type WriteResult,
} from "./salon-tx";

// Tab-only salon storage: the fallback when IndexedDB is confirmed
// unavailable, and a reference for tests. One tab's JavaScript is
// single-threaded and `write` runs `change` synchronously, so every write is
// atomic. Nothing is shared with other tabs or kept after the tab closes.

export class MemorySalonDb implements SalonDb {
  private salons = new Map<Workspace, SalonRecord>();
  private meta = new Map<string, unknown>();
  private listeners = new Set<(change: SalonChange) => void>();
  private errors = errorReporter();

  private copy(workspace: Workspace): SalonRecord | null {
    const record = this.salons.get(workspace);
    return record ? { ...record } : null;
  }

  async read(workspace: Workspace): Promise<SalonRecord | null> {
    return this.copy(workspace);
  }

  /** Both salons captured together, before anything can yield: a snapshot that existed. */
  async readAll(): Promise<Record<Workspace, SalonRecord | null>> {
    return { demo: this.copy("demo"), own: this.copy("own") };
  }

  async write<T>(scope: SalonScope, change: (tx: SalonTx) => T): Promise<WriteResult<T>> {
    // Runs before the first await, like a transaction: no other write can interleave.
    const snapshot = {
      salons: new Map((scope.salons ?? []).map((key) => [key, this.salons.get(key) ?? null] as const)),
      exists: new Map((scope.exists ?? []).map((key) => [key, this.salons.has(key)] as const)),
      meta: new Map((scope.meta ?? []).map((key) => [key, structuredClone(this.meta.get(key))] as const)),
    };
    const { value, ops } = runChange(snapshot, change);
    for (const op of ops) {
      if (op.store === "salons") {
        if (op.value) this.salons.set(op.key, op.value);
        else this.salons.delete(op.key);
      } else if (op.remove) this.meta.delete(op.key);
      else this.meta.set(op.key, op.value);
    }
    const changes = changesOf(ops);
    for (const change of changes) callEach(this.listeners, () => ({ workspace: change.workspace, record: change.record && { ...change.record } }), this.errors.report);
    return { ok: true, value, changes };
  }

  subscribe(listener: (change: SalonChange) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Memory writes do not fail. */
  onStorageFailure(): () => void {
    return () => undefined;
  }

  onListenerError(listener: (error: unknown) => void): () => void {
    return this.errors.subscribe(listener);
  }

  close() {
    this.listeners.clear();
  }
}
