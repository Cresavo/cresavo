// Trusted test operator only. Never imported by either transport client.
import { db } from "../../src/lib/db";
import { issueSyntheticMandate } from "../../src/lib/agent-api/mandates";

export async function grant(clientId: string, slot: { start: string; serviceId: string; staff: { id: string }; durationMinutes: number }, price: number, run: string) {
  const from = new Date(slot.start);
  return issueSyntheticMandate({ businessId: "demo", clientId, serviceId: slot.serviceId,
    staffId: slot.staff.id, validFrom: from.toISOString(),
    validUntil: new Date(+from + slot.durationMinutes * 60000).toISOString(),
    expiresAt: new Date(Math.min(+from, Date.now() + 3600000)).toISOString(),
    maxPriceOre: price, currency: "SEK", origin: "synthetic-operator", originReference: run }, db);
}

export async function cleanupRun(run: string) {
  if (!/^agentprov-[a-f0-9-]{36}$/.test(run)) throw new Error("PROOF_RESET_REFUSED");
  await db.$transaction(async tx => {
    const keys = await tx.agentApiKey.findMany({ where: { agentName: { startsWith: `${run}-` } } });
    const ids = keys.map(k => k.id), clients = keys.map(k => k.clientId);
    const links = await tx.agentBooking.findMany({ where: { clientId: { in: clients } } });
    await tx.agentApiEvent.deleteMany({ where: { keyId: { in: ids } } });
    await tx.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
    await tx.booking.deleteMany({ where: { id: { in: links.map(l => l.bookingId) } } });
    await tx.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
    await tx.agentApiKey.deleteMany({ where: { id: { in: ids } } });
    await tx.agentClient.deleteMany({ where: { id: { in: clients } } });
  });
}
