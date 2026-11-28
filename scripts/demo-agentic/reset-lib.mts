import type { Prisma } from "@prisma/client";

export const DEMO_SALON = "demo";

/**
 * Removes what the given OAuth clients did at the demo salon: their grants and credentials, the
 * proposals, mandates and bookings those grants made, pending codes and the clients' registrations.
 * Rows of any other OAuth client, agent API keys and ordinary bookings are left alone.
 */
export async function resetDemoClients(tx: Prisma.TransactionClient, oauthClientIds: string[]) {
  // Only clients the demo registered itself. A published client id (https://…) is shared by every
  // user of that assistant, so it is never accepted here.
  const ids = [...new Set(oauthClientIds)].filter(id => !id.startsWith("https://"));
  const grants = await tx.agentGrant.findMany({ where: { businessId: DEMO_SALON, oauthClientId: { in: ids } }, select: { id: true, clientId: true, keyId: true } });
  const clients = [...new Set(grants.map(g => g.clientId))], keys = grants.map(g => g.keyId);
  const scope = { businessId: DEMO_SALON, clientId: { in: clients } };
  const links = await tx.agentBooking.findMany({ where: scope, select: { bookingId: true, nativeBookingId: true } });
  const bookingIds = [...new Set(links.flatMap(l => [l.bookingId, l.nativeBookingId].filter((v): v is string => !!v)))];
  await tx.agentProposal.deleteMany({ where: scope });
  await tx.agentBooking.deleteMany({ where: scope });
  const bookings = await tx.booking.deleteMany({ where: { id: { in: bookingIds }, businessId: DEMO_SALON } });
  await tx.agentMandate.deleteMany({ where: scope });
  await tx.agentApiEvent.deleteMany({ where: { keyId: { in: keys } } });
  await tx.agentGrantToken.deleteMany({ where: { grantId: { in: grants.map(g => g.id) } } });
  await tx.agentGrant.deleteMany({ where: { id: { in: grants.map(g => g.id) } } });
  await tx.agentApiKey.deleteMany({ where: { id: { in: keys } } });
  // An agent client that also holds a grant from another OAuth client stays.
  const stillHeld = new Set((await tx.agentGrant.findMany({ where: { businessId: DEMO_SALON, clientId: { in: clients } }, select: { clientId: true } })).map(g => g.clientId));
  await tx.agentClient.deleteMany({ where: { businessId: DEMO_SALON, id: { in: clients.filter(c => !stillHeld.has(c)) } } });
  await tx.agentOAuthCode.deleteMany({ where: { businessId: DEMO_SALON, clientId: { in: ids } } });
  // A registration still used by a grant or a pending code anywhere (another salon included) stays.
  const inUse = new Set([
    ...(await tx.agentGrant.findMany({ where: { oauthClientId: { in: ids } }, select: { oauthClientId: true } })).map(g => g.oauthClientId),
    ...(await tx.agentOAuthCode.findMany({ where: { clientId: { in: ids } }, select: { clientId: true } })).map(c => c.clientId),
  ]);
  await tx.agentOAuthClient.deleteMany({ where: { id: { in: ids.filter(id => !inUse.has(id)) } } });
  return { grants: grants.length, bookings: bookings.count };
}
