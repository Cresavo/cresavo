import { test as base, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { createDatabaseClient } from "../../scripts/database.mjs";

export const test = base.extend<{
  synthetic: {
    marker: string;
    title: string;
    trackSession: (cookie: string) => void;
  };
}>({
  synthetic: [
    async ({ page }, provide) => {
      const marker = process.env.CLEANUP_PROBE_MARKER ?? `e2e-${randomUUID()}`;
      const title = process.env.BOOKING_DEMO
        ? "Demoerbjudande – 20 % på fotvård"
        : marker;
      const db = createDatabaseClient();
      const sessions = new Set<string>();
      const pending: Promise<void>[] = [];
      const trackSession = (cookie: string) => {
        const token = String(cookie).match(
          /booking_admin=([a-f0-9]{64})\./,
        )?.[1];
        if (token)
          sessions.add(createHash("sha256").update(token).digest("hex"));
      };
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/api/admin/login")
          pending.push(
            response
              .headerValue("set-cookie")
              .then((cookie) => trackSession(cookie ?? "")),
          );
      });
      try {
        await provide({ marker, title, trackSession });
      } finally {
        await Promise.all(pending);
        await db.adminSession.deleteMany({
          where: { id: { in: [...sessions] } },
        });
        await db.booking.deleteMany({
          where: { customerEmail: { startsWith: marker } },
        });
        await db.campaign.deleteMany({ where: { title } });
        await db.$disconnect();
      }
    },
    { auto: true, timeout: 30000 },
  ],
});
export { expect };
