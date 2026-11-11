import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { pruneSessions } from "../../src/lib/auth";

it("gallrar utgångna/återkallade sessioner i avgränsade batcher och behåller aktiva", async () => {
  const marker = `session-${randomUUID()}`;
  const now = new Date();
  const future = new Date(now.getTime() + 60000);
  try {
    await db.adminSession.createMany({
      data: [
        ...Array.from({ length: 105 }, (_, i) => ({
          id: `${marker}-expired-${i}`,
          expiresAt: now,
        })),
        { id: `${marker}-revoked`, expiresAt: future, revokedAt: now },
        { id: `${marker}-active`, expiresAt: future },
      ],
    });
    await pruneSessions(now);
    expect(
      await db.adminSession.count({ where: { id: { startsWith: marker } } }),
    ).toBe(7);
    await pruneSessions(now);
    expect(
      await db.adminSession.findMany({
        where: { id: { startsWith: marker } },
        select: { id: true },
      }),
    ).toEqual([{ id: `${marker}-active` }]);
  } finally {
    await db.adminSession.deleteMany({ where: { id: { startsWith: marker } } });
    await db.$disconnect();
  }
});
