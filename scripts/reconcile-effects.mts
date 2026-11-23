// Operator tool for the e-mail outbox's failed and uncertain rows
// (docs/operations/INCIDENT_RUNBOOK.md#reconciling-the-e-mail-outbox):
//
//   npm run effects:reconcile -- list [--tenant <id>]
//   npm run effects:reconcile -- retry <id...> --tenant <id> [--force-maybe-duplicate] [--apply]
//   npm run effects:reconcile -- mark-sent <id...> --tenant <id> [--apply]
//   npm run effects:reconcile -- mark-failed <id...> --tenant <id> [--apply]
//
// Uses DATABASE_URL, as a login that may read and update `tenant_effect`.
// A dry run unless --apply. Every id gets one JSON log line (the audit record);
// no message body or address is ever printed, only the recipient's domain.
import type { PrismaClient } from "@prisma/client";
import { listUnsettled, reconcileEffect } from "../src/lib/effect-reconcile";
import { formatList, parseReconcileArgs, USAGE } from "../src/lib/effect-reconcile-cli";
import { createDatabaseClient } from "./database.mjs";

const args = parseReconcileArgs(process.argv.slice(2), process.env);
if ("error" in args) {
  console.error(`effects:reconcile: ${args.error}\n\n${USAGE}`);
  process.exit(2);
}

const prisma = createDatabaseClient(process.env.DATABASE_URL, 1) as PrismaClient;
try {
  if (args.command === "list") {
    for (const line of formatList(await listUnsettled(prisma, { tenantId: args.tenant, limit: args.limit }))) console.log(line);
  } else {
    let refusals = 0;
    for (const effectId of args.ids) {
      const result = await reconcileEffect(prisma, args.command, effectId, { tenantId: args.tenant, apply: args.apply, forceMaybeDuplicate: args.forceMaybeDuplicate });
      if (result.outcome === "refused") refusals++;
      console.log(JSON.stringify({
        event: "effect_reconcile", at: new Date().toISOString(), actor: args.actor, action: args.command, tenantId: args.tenant, effectId,
        dryRun: !args.apply, force: args.forceMaybeDuplicate, outcome: result.outcome, ...(result.reason ? { reason: result.reason } : {}),
      }));
    }
    if (!args.apply) console.error("Dry run: nothing changed. Add --apply to make the changes above.");
    if (refusals) process.exitCode = 1;
  }
} catch (error) {
  // A lock timeout or a lost connection: the id it stopped at was not changed; the ones logged above were.
  console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "EFFECT_RECONCILE_FAILED");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
