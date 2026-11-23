// Erases one customer of one salon, for the operator who must repeat an erasure after a restore
// (docs/operations/BACKUP_RESTORE.md). It is the owner studio's erasure (PostgresStudioStore.eraseSubject) without
// the sign-in: the document, the audit log, the outbox and the stored replay results, in one transaction.
//
//   npm run store:erase -- <tenantId> <customerId>
//
// Uses DATABASE_URL (the application login: it may only erase through erase_subject, so the store runs with
// `erasure: "function"`) and STUDIO_STORE_HMAC_SECRET, and JOURNALS_ON_SERVER with JOURNAL_ENCRYPTION_KEY when the
// salon's journals are kept on the server. Nothing is sent: messages are acknowledged without delivery.
// Prints counts only, never a name or an address. Repeating it is safe.
import { SIMULATED_SINKS } from "../src/concept/store/effect-outbox";
import { PostgresStudioStore } from "../src/concept/store/postgres-studio-store";
import { journalStoreOption } from "../src/lib/owner-journals";
import { createDatabaseClient } from "./database.mjs";

const [tenantId, customerId] = process.argv.slice(2);
try {
  const hmacSecret = process.env.STUDIO_STORE_HMAC_SECRET;
  if (!tenantId || !customerId || !hmacSecret || hmacSecret.length < 32) throw new Error("usage");
  const prisma = createDatabaseClient(process.env.DATABASE_URL, 2);
  try {
    const store = new PostgresStudioStore({ prisma: prisma as never, hmacSecret, sinks: SIMULATED_SINKS, deliverAfterCommit: false, erasure: "function",
      // With server-side journals the key is needed to scrub the customer from other customers' encrypted entries.
      journals: journalStoreOption() });
    const result = await store.eraseSubject(tenantId, customerId, { actor: "operator", source: "restore-replay" });
    console.log(JSON.stringify(result.ok ? { ok: true, redacted: result.redacted, pendingPayments: result.pendingPayments, inFlightMessages: result.inFlightMessages } : result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
} catch {
  console.error("STORE_ERASE_FAILED");
  process.exitCode = 1;
}
