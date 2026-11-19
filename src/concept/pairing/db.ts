import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export type Tx = Prisma.TransactionClient;
const shared = globalThis as typeof globalThis & { pairingDb?: PrismaClient };

/** Lazy even when building the public studio. Pairing queries use only Pair* tables. */
export function pairingDb() {
  if (process.env.ASSISTANT_PAIRING !== "1" || !process.env.DATABASE_URL) throw new Error("PAIRING_DISABLED");
  return shared.pairingDb ??= new PrismaClient({ adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000,
    options: "-c timezone=UTC",
  }) });
}

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function sweep(tx: Tx, now = new Date()) {
  const where = { expiresAt: { lte: now } };
  await tx.pairWorkspace.deleteMany({ where: { OR: [where, { hardExpiry: { lte: now } }] } });
  await tx.pairCode.deleteMany({ where });
  await tx.pairClient.deleteMany({ where });
  await tx.pairBudget.deleteMany({ where });
}
