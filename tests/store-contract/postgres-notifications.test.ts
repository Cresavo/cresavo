import type { PrismaClient } from "@prisma/client";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { PostgresNotifications } from "@/concept/store/postgres-notifications";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
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

beforeEach(() => vi.clearAllMocks());

const connection = "postgresql://127.0.0.1:1/studio_notifications_test";

const notify = (client: pg.Client, version: number, sender?: string) => client.emit("notification", {
  channel: "tenant_changes", payload: JSON.stringify({ tenantId: "fixture", version, sender }), processId: 100,
});

it("suppresses its own echoes and signals refresh after each successful LISTEN", async () => {
  vi.useFakeTimers();
  const changes: StoreChange[] = [];
  const refresh = vi.fn();
  const listener = new PostgresNotifications(connection, (change) => changes.push(change), refresh);
  try {
    const clients = vi.mocked(pg.Client).mock.instances;
    listener.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(listener.ready).toBe(true);
    const [first] = clients;
    expect(first.query).toHaveBeenCalledWith("LISTEN tenant_changes");
    expect(refresh).toHaveBeenCalledTimes(1);

    notify(first, 1, listener.sender);
    notify(first, 2);
    expect(changes).toEqual([{ tenantId: "fixture", version: 2, effects: [] }]);

    first.emit("error", new Error("Database connection closed"));
    expect(first.end).toHaveBeenCalledOnce();
    expect(listener.ready).toBe(false);
    notify(first, 3, "another-store");
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(clients).toHaveLength(2);
    const [, second] = clients;
    expect(listener.ready).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(changes.map((change) => change.version)).toEqual([2]);
    notify(second, 4, listener.sender);
    notify(second, 4, "another-store");
    expect(changes.map((change) => change.version)).toEqual([2, 4]);

    listener.stop();
    second.emit("end");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(second.end).toHaveBeenCalledOnce();
    expect(clients).toHaveLength(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {
    listener.stop();
    vi.useRealTimers();
  }
});

it("ignores late LISTEN completion after the last subscriber releases the connection", async () => {
  const refresh = vi.fn();
  const listener = new PostgresNotifications(connection, vi.fn(), refresh);
  listener.start();
  const client = vi.mocked(pg.Client).mock.instances[0];
  const pendingListen = Promise.withResolvers<void>();
  vi.mocked(client.query).mockImplementationOnce(() => pendingListen.promise);
  try {
    await vi.waitFor(() => expect(client.query).toHaveBeenCalledOnce());
    expect(listener.ready).toBe(false);
    listener.stop();
    pendingListen.resolve();
    await pendingListen.promise;
    expect(refresh).not.toHaveBeenCalled();
    expect(listener.ready).toBe(false);
  } finally {
    listener.stop();
  }
});

it("refreshes current subscribers after a missed change and removes released callbacks", async () => {
  vi.useFakeTimers();
  const store = new PostgresStudioStore({
    prisma: {} as PrismaClient,
    hmacSecret: "fictional test secret with 32 characters",
    sinks: { payment() {}, message() {} },
    listenerConnectionString: connection,
  });
  try {
    let latestVersion = 1;
    const versions: number[] = [];
    const onChange = vi.fn();
    const released = vi.fn();
    store.subscribe("fixture", vi.fn(), { onRefresh: async () => { throw new Error("Subscriber failed"); } });
    store.subscribe("fixture", onChange, { onRefresh: () => { versions.push(latestVersion); } });
    await vi.advanceTimersByTimeAsync(0);
    const unsubscribe = store.subscribe("fixture", vi.fn(), { onRefresh: released });
    await vi.advanceTimersByTimeAsync(0);
    expect(released).toHaveBeenCalledOnce();
    unsubscribe();

    const [client] = vi.mocked(pg.Client).mock.instances;
    client.emit("end");
    latestVersion = 2;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(versions).toEqual([1, 2]);
    expect(onChange).not.toHaveBeenCalled();
    expect(released).toHaveBeenCalledOnce();
  } finally {
    store.close();
    vi.useRealTimers();
  }
});
