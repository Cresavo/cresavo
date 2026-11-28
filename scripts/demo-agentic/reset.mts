import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";
assertTestDatabase();
const db = createDatabaseClient();
try {
  await db.$transaction(async tx => {
    const oauth = await tx.agentOAuthClient.findMany({ where: { name: "Cresavo agentic demo" } });
    const ids = oauth.map(c => c.id);
    const grants = await tx.agentGrant.findMany({ where: { oauthClientId: { in: ids } } });
    const clients = grants.map(g => g.clientId), keys = grants.map(g => g.keyId);
    const links = await tx.agentBooking.findMany({ where: { clientId: { in: clients } } });
    await tx.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
    await tx.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
    await tx.booking.deleteMany({ where: { id: { in: links.flatMap(l => l.nativeBookingId ? [l.nativeBookingId] : []) } } });
    await tx.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
    await tx.agentApiEvent.deleteMany({ where: { keyId: { in: keys } } });
    await tx.agentGrant.deleteMany({ where: { id: { in: grants.map(g => g.id) } } });
    await tx.agentApiKey.deleteMany({ where: { id: { in: keys } } });
    await tx.agentClient.deleteMany({ where: { id: { in: clients } } });
    await tx.agentOAuthCode.deleteMany({ where: { clientId: { in: ids } } });
    await tx.agentOAuthClient.deleteMany({ where: { id: { in: ids } } });
  });
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seed failed");
  console.log("Agentic demo data reset and seed applied.");
} catch { console.error("Demo reset failed."); process.exitCode = 1; }
finally { await db.$disconnect(); }
