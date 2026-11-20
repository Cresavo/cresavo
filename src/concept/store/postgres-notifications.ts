import pg from "pg";
import type { Prisma } from "@prisma/client";
import type { StoreChange, TenantId } from "./studio-store";

const CHANNEL = "tenant_changes";
const RETRY_MS = 250;

interface Session {
  client: pg.Client;
  ready: boolean;
}

const echoKey = (pid: number, tenantId: TenantId, version: number) => JSON.stringify([pid, tenantId, version]);

/** One dedicated connection while this store has subscribers. */
export class PostgresNotifications {
  private session?: Session;
  private retry?: ReturnType<typeof setTimeout>;
  private readonly echoes = new Map<string, { pending: boolean }>();

  constructor(
    private readonly connectionString: string,
    private readonly fanOut: (change: StoreChange) => void,
  ) {}

  start() {
    if (this.session || this.retry) return;
    const client = new pg.Client({ connectionString: this.connectionString, connectionTimeoutMillis: 5_000, keepAlive: true });
    const session: Session = { client, ready: false };
    this.session = session;
    const reconnect = () => {
      if (this.session !== session) return;
      this.stop();
      this.retry = setTimeout(() => {
        this.retry = undefined;
        this.start();
      }, RETRY_MS);
      this.retry.unref();
    };
    client.on("error", reconnect);
    client.on("end", reconnect);
    client.on("notification", ({ channel, payload, processId }) => {
      if (this.session !== session || channel !== CHANNEL || !payload) return;
      let change: { tenantId?: unknown; version?: unknown } | null;
      try {
        change = JSON.parse(payload);
      } catch {
        return;
      }
      if (typeof change?.tenantId !== "string" || !change.tenantId ||
          typeof change.version !== "number" || !Number.isSafeInteger(change.version) || change.version < 1) return;
      if (this.echoes.delete(echoKey(processId, change.tenantId, change.version))) return;
      this.fanOut({ tenantId: change.tenantId, version: change.version, effects: [] });
    });
    void (async () => {
      try {
        await client.connect();
        if (this.session !== session) return;
        await client.query("LISTEN tenant_changes");
        session.ready = true;
      } catch {
        reconnect();
      }
    })();
  }

  stop() {
    const session = this.session;
    this.session = undefined;
    if (this.retry) clearTimeout(this.retry);
    this.retry = undefined;
    for (const [key, echo] of this.echoes) {
      if (!echo.pending) this.echoes.delete(key);
    }
    if (session) void session.client.end().catch(() => {});
  }

  get ready() {
    return this.session?.ready ?? false;
  }

  /** Reserve the echo before commit, even if LISTEN is still connecting. */
  ignoreEcho(pid: number, tenantId: TenantId, version: number): (committed: boolean) => void {
    const key = echoKey(pid, tenantId, version);
    const echo = { pending: true };
    this.echoes.set(key, echo);
    return (committed) => {
      echo.pending = false;
      if ((!committed || !this.session) && this.echoes.get(key) === echo) this.echoes.delete(key);
    };
  }
}

/** PostgreSQL releases this notification only if and when the transaction commits. */
export async function notifyTenantChange(tx: Prisma.TransactionClient, tenantId: TenantId, version: number) {
  const payload = JSON.stringify({ tenantId, version });
  const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`
    SELECT pg_backend_pid() AS pid FROM pg_notify(${CHANNEL}, ${payload})`;
  return pid;
}
