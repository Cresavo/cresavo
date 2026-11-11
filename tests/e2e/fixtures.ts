import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const test = base.extend<{
  synthetic: { marker: string; title: string };
}>({
  synthetic: [
    async ({}, provide) => {
      const marker = process.env.CLEANUP_PROBE_MARKER ?? `e2e-${randomUUID()}`;
      const title = process.env.BOOKING_DEMO
        ? "Demoerbjudande – 20 % på fotvård"
        : marker;
      const db = new PrismaClient();
      try {
        await provide({ marker, title });
      } finally {
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
