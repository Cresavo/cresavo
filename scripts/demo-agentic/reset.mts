// Resets the customer-agent demo (docs/demo-agentic-booking.md) on a local *_demo or *_test database.
// Scope: every OAuth grant at the demo salon, whichever client made it (the scripted assistant,
// Claude Code or another connector), with the proposals, mandates and bookings those grants made,
// plus pending OAuth codes and dynamically registered OAuth clients. Agent API keys made with
// `npm run agent-keys` and ordinary bookings are left alone. Hosted databases are refused.
import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";

const SALON = "demo";
assertTestDatabase();
const db = createDatabaseClient();
try {
  const counts = await db.$transaction(async tx => {
    const grants = await tx.agentGrant.findMany({ where: { businessId: SALON }, select: { id: true, clientId: true, keyId: true } });
    const clients = [...new Set(grants.map(g => g.clientId))], keys = grants.map(g => g.keyId);
    const scope = { businessId: SALON, clientId: { in: clients } };
    const links = await tx.agentBooking.findMany({ where: scope, select: { bookingId: true, nativeBookingId: true } });
    const bookingIds = [...new Set(links.flatMap(l => [l.bookingId, l.nativeBookingId].filter((v): v is string => !!v)))];
    await tx.agentProposal.deleteMany({ where: scope });
    await tx.agentBooking.deleteMany({ where: scope });
    const bookings = await tx.booking.deleteMany({ where: { id: { in: bookingIds }, businessId: SALON } });
    await tx.agentMandate.deleteMany({ where: scope });
    await tx.agentApiEvent.deleteMany({ where: { keyId: { in: keys } } });
    await tx.agentGrant.deleteMany({ where: { id: { in: grants.map(g => g.id) } } });
    await tx.agentApiKey.deleteMany({ where: { id: { in: keys } } });
    await tx.agentClient.deleteMany({ where: { businessId: SALON, id: { in: clients } } });
    await tx.agentOAuthCode.deleteMany({ where: { businessId: SALON } });
    // Registrations hold no salon data; on a demo database they all come from demo runs.
    await tx.agentOAuthClient.deleteMany({});
    return { grants: grants.length, bookings: bookings.count };
  });
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seed failed");
  console.log(`Agentic demo reset: ${counts.grants} assistant connection(s) and ${counts.bookings} booking(s) removed, seed applied.`);
} catch { console.error("Demo reset failed."); process.exitCode = 1; }
finally { await db.$disconnect(); }
