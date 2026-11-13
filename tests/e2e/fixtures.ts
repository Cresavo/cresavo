import { test as base, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { createAdminUser } from "../../src/lib/admin-accounts";

export const test = base.extend<{
  synthetic: {
    marker: string;
    title: string;
    trackSession: (cookie: string) => void;
    trackResource: (kind: "service" | "staff" | "customer", id: string) => void;
    trackWorkspaceRequest: (key: string, channel?: "admin" | "mcp") => void;
    admin: { email: string; password: string; id: string };
  };
}>({
  synthetic: [
    async ({ page }, provide) => {
      const marker = process.env.CLEANUP_PROBE_MARKER ?? `e2e-${randomUUID()}`;
      const title = process.env.BOOKING_DEMO
        ? "Demoerbjudande – 20 % på fotvård"
        : marker;
      const db = createDatabaseClient();
      const email = process.env.BOOKING_DEMO
        ? `admin-${randomUUID().slice(0, 8)}@example.test`
        : `${marker}-admin@example.test`;
      const password = "synthetic-e2e-admin-password-2026";
      const account = await createAdminUser(email, password);
      const sessions = new Set<string>();
      const services = new Set<string>(),
        staff = new Set<string>(),
        customers = new Set<string>(),
        workspaceKeys = new Set<string>();
      const trackResource = (
        kind: "service" | "staff" | "customer",
        id: string,
      ) =>
        (kind === "service"
          ? services
          : kind === "staff"
            ? staff
            : customers
        ).add(id);
      const trackWorkspaceRequest = (
        key: string,
        channel: "admin" | "mcp" = "admin",
      ) =>
        workspaceKeys.add(
          createHash("sha256")
            .update(
              channel === "admin"
                ? `admin:${account.id}:${key}`
                : `local-mcp:local-workspace-channel:v1:${key}`,
            )
            .digest("hex"),
        );
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
        const endpoint = new URL(response.url()).pathname;
        if (
          response.request().method() === "POST" &&
          endpoint.startsWith("/api/admin/") &&
          !endpoint.endsWith("/login")
        ) {
          const key = response.request().headers()["idempotency-key"];
          if (key) trackWorkspaceRequest(key);
          if (
            (endpoint === "/api/admin/services" ||
              endpoint === "/api/admin/staff" ||
              endpoint === "/api/admin/customers") &&
            response.ok()
          ) {
            pending.push(
              response
                .json()
                .then((value) => {
                  const input = response.request().postDataJSON();
                  if (!input.id && typeof value.id === "string")
                    trackResource(
                      endpoint.endsWith("/services")
                        ? "service"
                        : endpoint.endsWith("/customers")
                          ? "customer"
                          : "staff",
                      value.id,
                    );
                })
                .catch(() => {}),
            );
          }
        }
      });
      try {
        await provide({
          marker,
          title,
          trackSession,
          trackResource,
          trackWorkspaceRequest,
          admin: { email, password, id: account.id },
        });
      } finally {
        await Promise.all(pending);
        await db.adminSession.deleteMany({
          where: { id: { in: [...sessions] } },
        });
        const ownBookings = await db.booking.findMany({
          where: {
            OR: [
              { customerEmail: { startsWith: marker } },
              { serviceId: { in: [...services] } },
            ],
          },
          select: { id: true },
        });
        const capacityDecisions = await db.capacityDecision.findMany({
          where: { bookingId: { in: ownBookings.map((b) => b.id) } },
          select: { id: true, campaignId: true },
        });
        await db.capacityDecision.deleteMany({
          where: { id: { in: capacityDecisions.map((d) => d.id) } },
        });
        await db.campaign.deleteMany({
          where: {
            id: {
              in: capacityDecisions.flatMap((d) =>
                d.campaignId ? [d.campaignId] : [],
              ),
            },
          },
        });
        await db.booking.deleteMany({
          where: {
            OR: [
              { customerEmail: { startsWith: marker } },
              { serviceId: { in: [...services] } },
            ],
          },
        });
        await db.campaign.deleteMany({ where: { title } });
        await db.customer.deleteMany({ where: { id: { in: [...customers] } } });
        await db.workspaceRequest.deleteMany({
          where: { businessId: "demo", key: { in: [...workspaceKeys] } },
        });
        await db.staff.deleteMany({ where: { id: { in: [...staff] } } });
        await db.service.deleteMany({ where: { id: { in: [...services] } } });
        await db.adminSession.deleteMany({ where: { userId: account.id } });
        await db.adminUser.delete({ where: { id: account.id } });
        await db.$disconnect();
      }
    },
    { auto: true, timeout: 30000 },
  ],
});
export { expect };
