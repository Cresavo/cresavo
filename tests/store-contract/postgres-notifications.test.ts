import pg from "pg";
import { expect, it, vi } from "vitest";
import { PostgresNotifications } from "@/concept/store/postgres-notifications";
import type { StoreChange } from "@/concept/store/studio-store";

vi.mock("pg", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    default: {
      Client: vi.fn(class extends EventEmitter {
        connect = vi.fn(async () => {});
        query = vi.fn(async () => {});
        end = vi.fn(async () => {});
      }),
    },
  };
});

it("recognises the writer's echo, retries a lost listener and stops on release", async () => {
  vi.useFakeTimers();
  const changes: StoreChange[] = [];
  const listener = new PostgresNotifications("postgresql://127.0.0.1:1/studio_notifications_test", (change) => changes.push(change));
  try {
    const clients = vi.mocked(pg.Client).mock.instances;
    listener.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(listener.ready).toBe(true);
    const [first] = clients;
    expect(first.query).toHaveBeenCalledWith("LISTEN tenant_changes");

    const notify = (client: pg.Client, processId: number, version: number) => client.emit("notification", {
      channel: "tenant_changes", payload: JSON.stringify({ tenantId: "fixture", version }), processId,
    });
    const finish = listener.ignoreEcho(100, "fixture", 1);
    notify(first, 100, 1);
    finish(true);
    notify(first, 200, 2);
    expect(changes).toEqual([{ tenantId: "fixture", version: 2, effects: [] }]);

    first.emit("error", new Error("Database connection closed"));
    expect(first.end).toHaveBeenCalledOnce();
    expect(listener.ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(clients).toHaveLength(2);
    const [, second] = clients;
    expect(listener.ready).toBe(true);
    notify(first, 200, 3);
    notify(second, 200, 4);
    expect(changes.map((change) => change.version)).toEqual([2, 4]);

    listener.stop();
    second.emit("end");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(second.end).toHaveBeenCalledOnce();
    expect(clients).toHaveLength(2);
  } finally {
    listener.stop();
    vi.useRealTimers();
  }
});
