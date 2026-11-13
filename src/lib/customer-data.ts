import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { DomainError } from "./errors";
import {
  assertWorkspaceActor,
  lockConfiguration,
  workspaceWrite,
  type WorkspaceActor,
} from "./workspace-write";

export const REMOVED_CONTACT_NAME = "Kontaktuppgifter borttagna";
export const REMOVED_CONTACT_EMAIL = "removed@example.test";
const id = z.string().min(1).max(128);
const token = z.string().regex(/^[a-f0-9]{64}$/);
export const customerDataSchema = z
  .object({ id, expectedVersion: z.number().int().positive() })
  .strict();
export const customerExportSchema = customerDataSchema
  .extend({
    limit: z.number().int().min(1).max(100).default(100),
    cursor: id.optional(),
    expectedToken: token.optional(),
  })
  .strict();
export const customerContactRemovalSchema = customerDataSchema
  .extend({ expectedToken: token, confirmed: z.literal(true) })
  .strict();
const changed = () =>
  new DomainError("Underlaget har ändrats. Förhandsgranska igen.", 409);

function webAdmin(actor: WorkspaceActor) {
  if (actor.kind !== "admin") throw new DomainError("Åtkomst nekad", 403);
  return actor;
}
async function scope(
  tx: Prisma.TransactionClient,
  value: z.infer<typeof customerDataSchema>,
) {
  const customer = await tx.customer.findFirst({
    where: { id: value.id, businessId },
  });
  if (!customer) throw new DomainError("Kunden finns inte", 404);
  if (!customer.email.endsWith("@example.test"))
    throw new DomainError(
      "POC-flödet tillåter endast syntetiska testadresser.",
      403,
    );
  if (customer.version !== value.expectedVersion) throw changed();
  const bookings = await tx.booking.findMany({
    where: { businessId, customerId: customer.id },
    orderBy: { id: "asc" },
    take: 1001,
    select: {
      id: true,
      version: true,
      status: true,
      endsAt: true,
      contactRemovedAt: true,
    },
  });
  if (bookings.length > 1000)
    throw new DomainError(
      "Underlaget är för stort för POC-flödet. Högst 1000 kopplade bokningar stöds.",
      413,
    );
  const expectedToken = createHash("sha256")
    .update(
      JSON.stringify({
        customerId: customer.id,
        version: customer.version,
        bookings,
      }),
    )
    .digest("hex");
  return { customer, bookings, expectedToken };
}

// Rare, explicitly requested privacy operations share the existing configuration
// lock with booking/customer writes. No new lock order or unbounded export.
export async function previewCustomerContactRemoval(
  input: unknown,
  actor: WorkspaceActor,
) {
  webAdmin(actor);
  const value = customerDataSchema.parse(input);
  return db.$transaction(
    async (tx) => {
      await lockConfiguration(tx, true);
      await assertWorkspaceActor(tx, actor);
      const { customer, bookings, expectedToken } = await scope(tx, value);
      const activeVisits = bookings.filter(
        (b) => b.status === "confirmed" && b.endsAt > new Date(),
      ).length;
      return {
        id: customer.id,
        version: customer.version,
        expectedToken,
        linkedBookings: bookings.length,
        activeVisits,
        contactRemovedAt: customer.contactRemovedAt?.toISOString() ?? null,
        canRemove: activeVisits === 0 && !customer.contactRemovedAt,
      };
    },
    { timeout: 30000 },
  );
}

export async function exportCustomerData(
  input: unknown,
  actor: WorkspaceActor,
) {
  const admin = webAdmin(actor),
    value = customerExportSchema.parse(input);
  if (value.cursor && !value.expectedToken)
    throw new DomainError("Fortsättningen kräver samma exportunderlag.");
  return db.$transaction(
    async (tx) => {
      await lockConfiguration(tx, true);
      await assertWorkspaceActor(tx, admin);
      const { customer, bookings, expectedToken } = await scope(tx, value);
      if (value.expectedToken && value.expectedToken !== expectedToken)
        throw changed();
      if (value.cursor && !bookings.some((b) => b.id === value.cursor))
        throw new DomainError("Ogiltig sidmarkör för kundexporten.");
      const page = await tx.booking.findMany({
        where: {
          businessId,
          customerId: customer.id,
          ...(value.cursor && { id: { gt: value.cursor } }),
        },
        orderBy: { id: "asc" },
        take: value.limit + 1,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          serviceName: true,
          staffId: true,
          startsAt: true,
          endsAt: true,
          initialStartsAt: true,
          initialEndsAt: true,
          duration: true,
          buffer: true,
          priceOre: true,
          status: true,
          version: true,
          createdAt: true,
          contactRemovedAt: true,
        },
      });
      const rows = page.slice(0, value.limit);
      await tx.customerDataAction.create({
        data: {
          businessId,
          customerId: customer.id,
          actorId: admin.id,
          action: "export",
          bookingCount: rows.length,
        },
      });
      return {
        schemaVersion: 1,
        scope: "customer_card_and_linked_bookings" as const,
        exportedAt: new Date().toISOString(),
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          archived: customer.archived,
          version: customer.version,
          createdAt: customer.createdAt,
          contactRemovedAt: customer.contactRemovedAt,
        },
        bookings: rows,
        totalLinkedBookings: bookings.length,
        expectedToken,
        nextCursor: page.length > value.limit ? rows.at(-1)!.id : null,
        limitations: [
          "Endast valt kundkort och uttryckligen kopplade bokningar.",
          "Varje fil innehåller högst 100 bokningar; fortsättning krävs om nextCursor finns.",
          "Fristående bokningar, åtgärds-/driftloggar, backups och andra system ingår inte. Inte ett fullständigt GDPR-registerutdrag.",
        ],
      };
    },
    { timeout: 30000 },
  );
}

export async function removeCustomerContact(
  input: unknown,
  key: string,
  actor: WorkspaceActor,
) {
  const admin = webAdmin(actor),
    value = customerContactRemovalSchema.parse(input);
  return workspaceWrite(
    "remove_customer_contact",
    value,
    key,
    admin,
    true,
    async (tx) => {
      const { customer, bookings, expectedToken } = await scope(tx, value);
      if (value.expectedToken !== expectedToken) throw changed();
      if (customer.contactRemovedAt)
        return {
          id: customer.id,
          version: customer.version,
          contactRemovedAt: customer.contactRemovedAt.toISOString(),
        };
      if (
        bookings.some((b) => b.status === "confirmed" && b.endsAt > new Date())
      )
        throw new DomainError(
          "Hantera kommande eller pågående bokningar innan kontaktuppgifterna tas bort.",
          409,
        );
      const now = new Date();
      await tx.booking.updateMany({
        where: { businessId, customerId: customer.id },
        // Booking operation versions/cancellation sources stay unchanged. The
        // separate privacy timestamp records this contact-only snapshot change.
        data: {
          customerName: REMOVED_CONTACT_NAME,
          customerEmail: REMOVED_CONTACT_EMAIL,
          contactRemovedAt: now,
        },
      });
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: {
          name: REMOVED_CONTACT_NAME,
          email: REMOVED_CONTACT_EMAIL,
          phone: null,
          archived: true,
          contactRemovedAt: now,
          version: { increment: 1 },
        },
      });
      await tx.customerDataAction.create({
        data: {
          businessId,
          customerId: customer.id,
          actorId: admin.id,
          action: "remove_contact",
          bookingCount: bookings.length,
        },
      });
      return {
        id: updated.id,
        version: updated.version,
        contactRemovedAt: now.toISOString(),
      };
    },
  );
}
