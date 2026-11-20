import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Prisma } from "@prisma/client";
import type { StoreChange, TenantId } from "./studio-store";
import { assertDatabaseMode } from "../../../scripts/database.mjs";

const CHANNEL = "tenant_changes";
const RETRY_MS = 250;

interface Session {
  client: pg.Client;
  ready: boolean;
}

/** One dedicated connection while this store has subscribers. */
export class PostgresNotifications {
  readonly sender = randomUUID();
  private session?: Session;
  private retry?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly connectionString: string,
    private readonly fanOut: (change: StoreChange) => void,
    private readonly onReady: () => void,
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
    client.on("notification", ({ channel, payload }) => {
      if (this.session !== session || channel !== CHANNEL || !payload) return;
      let change: { tenantId?: unknown; version?: unknown; sender?: unknown } | null;
      try {
        change = JSON.parse(payload);
      } catch {
        return;
      }
      if (typeof change?.tenantId !== "string" || !change.tenantId ||
          typeof change.version !== "number" || !Number.isSafeInteger(change.version) || change.version < 1) return;
      if (change.sender === this.sender) return;
      this.fanOut({ tenantId: change.tenantId, version: change.version, effects: [] });
    });
    void (async () => {
      try {
        await client.connect();
        await assertDatabaseMode(client);
        if (this.session !== session) return;
        await client.query("LISTEN tenant_changes");
        if (this.session !== session) return;
        session.ready = true;
        this.onReady();
      } catch (error) {
        if (error instanceof Error && error.message === "BOOKING_DATABASE_MODE_MISMATCH") this.stop();
        else reconnect();
      }
    })();
  }

  stop() {
    const session = this.session;
    this.session = undefined;
    if (this.retry) clearTimeout(this.retry);
    this.retry = undefined;
    if (session) void session.client.end().catch(() => {});
  }

  get ready() {
    return this.session?.ready ?? false;
  }
}

/** PostgreSQL releases this notification only if and when the transaction commits. */
export async function notifyTenantChange(tx: Prisma.TransactionClient, tenantId: TenantId, version: number, sender?: string) {
  const payload = JSON.stringify({ tenantId, version, sender });
  await tx.$queryRaw`SELECT 1 FROM pg_notify(${CHANNEL}, ${payload})`;
}
