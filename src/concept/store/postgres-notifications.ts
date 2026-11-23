import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import type { Prisma } from "@prisma/client";
import type { TenantId } from "./studio-store";
import { assertDatabaseMode } from "../../../scripts/database.mjs";

// Change notifications carry an opaque wake-up tag, never a tenant id or a
// version: every database login may LISTEN on a channel and send to it. The tag
// is an HMAC of the tenant id under the store secret, so only a process that
// already subscribes to that tenant recognises it; the version is then read in
// the tenant's own scope. A forged or replayed tag only causes that read.

const CHANNEL = "tenant_changes";
const RETRY_MS = 250;
const TAG = /^[0-9a-f]{32}$/;

/** The wake-up tag of a tenant: stable per tenant and secret, so it identifies nothing to other logins. */
export function wakeTag(secret: string, tenantId: TenantId): string {
  return createHmac("sha256", secret).update(`tenant-change:${tenantId}`).digest("hex").slice(0, 32);
}

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
    private readonly onWake: (tag: string) => void,
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
      let change: { tag?: unknown; sender?: unknown } | null;
      try {
        change = JSON.parse(payload);
      } catch {
        return;
      }
      if (typeof change?.tag !== "string" || !TAG.test(change.tag)) return;
      if (change.sender === this.sender) return;
      this.onWake(change.tag);
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

/** PostgreSQL releases this notification only if and when the transaction commits. `tag` is the tenant's `wakeTag`. */
export async function notifyTenantChange(tx: Prisma.TransactionClient, tag: string, sender?: string) {
  const payload = JSON.stringify({ tag, sender });
  await tx.$queryRaw`SELECT 1 FROM pg_notify(${CHANNEL}, ${payload})`;
}
