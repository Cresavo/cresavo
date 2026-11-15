import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createCustomer, editCustomer } from "../../src/lib/customers";
import {
  createBooking,
  emailCapKey,
  hashedEmailCapKey,
} from "../../src/lib/domain";
import { cancelBooking } from "../../src/lib/booking-mutations";
import { decideCapacity, listCapacity } from "../../src/lib/capacity";
import {
  exportCustomerData,
  previewCustomerContactRemoval,
  removeCustomerContact,
  REMOVED_CONTACT_NAME,
  REMOVED_CONTACT_EMAIL,
} from "../../src/lib/customer-data";
import { LOCAL_WORKSPACE_ACTOR } from "../../src/lib/workspace-write";

const marker = `lifecycle-${randomUUID()}`,
  userId = marker + "-admin",
  serviceId = marker + "-service",
  staffId = marker + "-staff";
const actor = { kind: "admin" as const, id: userId },
  foreign = { kind: "admin" as const, id: marker + "-foreign" };
const customers: string[] = [],
  ledger: string[] = [];
function key() {
  const k = randomUUID();
  ledger.push(
    createHash("sha256").update(`admin:${userId}:${k}`).digest("hex"),
  );
  return k;
}
beforeAll(async () => {
  await db.adminUser.createMany({
    data: [actor, foreign].map((a, i) => ({
      id: a.id,
      email: a.id + "@example.test",
      passwordHash: "unused-synthetic",
      businessId: i ? "other" : "demo",
    })),
  });
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Syntetisk behandling",
      duration: 30,
      priceOre: 45000,
    },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: "Syntetisk personal",
      serviceIds: [serviceId],
      weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        periods: [{ start: "09:00", end: "17:00" }],
        breaks: [],
      })),
      exceptions: [],
    },
  });
});
async function customer() {
  const row = await createCustomer(
    {
      name: "Syntetisk kontakt " + randomUUID(),
      email: marker + "@example.test",
      phone: null,
    },
    key(),
    actor,
  );
  customers.push(row.id);
  return row;
}
async function history(customerId: string | null, count = 1) {
  const start = DateTime.now()
    .minus({ days: 3 })
    .startOf("day")
    .set({ hour: 9 })
    .toJSDate();
  const ids = Array.from({ length: count }, () => randomUUID());
  await db.booking.createMany({
    data: ids.map((id) => ({
      id,
      businessId: "demo",
      customerId,
      serviceId,
      staffId,
      startsAt: start,
      endsAt: new Date(+start + 1800000),
      duration: 30,
      priceOre: 45000,
      serviceName: "Historisk syntetisk behandling",
      customerName: "Historiskt syntetiskt namn",
      customerEmail: marker + "@example.test",
      status: "cancelled",
    })),
  });
  return ids;
}
async function upcoming(customerId: string, hour = 9) {
  const start = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 2 })
    .startOf("day")
    .set({ hour })
    .toUTC()
    .toISO()!;
  return createBooking(
    { customerId, serviceId, staffId, start },
    randomUUID(),
    undefined,
    actor,
  );
}
async function removal(customerId: string, version: number) {
  const preview = await previewCustomerContactRemoval(
    { id: customerId, expectedVersion: version },
    actor,
  );
  return {
    id: customerId,
    expectedVersion: version,
    expectedToken: preview.expectedToken,
    confirmed: true as const,
  };
}

it("exports 150 linked bookings in bounded, disjoint pages and never matches another card by email", async () => {
  const c = await customer(),
    other = await customer();
  await history(c.id, 150);
  const [foreignBooking] = await history(other.id);
  const first = await exportCustomerData(
    { id: c.id, expectedVersion: c.version },
    actor,
  );
  expect(first.bookings).toHaveLength(100);
  expect(first.totalLinkedBookings).toBe(150);
  const second = await exportCustomerData(
    {
      id: c.id,
      expectedVersion: c.version,
      cursor: first.nextCursor,
      expectedToken: first.expectedToken,
    },
    actor,
  );
  expect(second.bookings).toHaveLength(50);
  expect(second.nextCursor).toBeNull();
  expect(
    new Set([...first.bookings, ...second.bookings].map((b) => b.id)).size,
  ).toBe(150);
  expect(first.customer.email).toBe(marker + "@example.test");
  for (const field of [
    "clientKey",
    "emailCapKey",
    "requestHash",
    "passwordHash",
    foreignBooking,
  ])
    expect(JSON.stringify(first)).not.toContain(field);
  expect(
    await db.customerDataAction.count({
      where: { customerId: c.id, action: "export" },
    }),
  ).toBe(2);
  await expect(
    exportCustomerData(
      {
        id: c.id,
        expectedVersion: c.version,
        cursor: foreignBooking,
        expectedToken: first.expectedToken,
      },
      actor,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    exportCustomerData(
      { id: c.id, expectedVersion: c.version, cursor: first.nextCursor },
      actor,
    ),
  ).rejects.toMatchObject({ status: 400 });
});

it("rejects local MCP, inactive/missing/foreign admins, foreign customer ids, invalid inputs and stale export scope", async () => {
  const c = await customer();
  await history(c.id, 2);
  for (const a of [
    LOCAL_WORKSPACE_ACTOR,
    foreign,
    { kind: "admin" as const, id: "missing" },
  ]) {
    await expect(
      exportCustomerData({ id: c.id, expectedVersion: 1 }, a),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      previewCustomerContactRemoval({ id: c.id, expectedVersion: 1 }, a),
    ).rejects.toMatchObject({ status: 403 });
  }
  const foreignCustomer = await db.customer.create({
    data: {
      businessId: "other",
      name: "Annan syntetisk kund",
      email: "other@example.test",
    },
  });
  customers.push(foreignCustomer.id);
  await expect(
    exportCustomerData({ id: foreignCustomer.id, expectedVersion: 1 }, actor),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    exportCustomerData({ id: c.id, expectedVersion: 1, limit: 101 }, actor),
  ).rejects.toThrow();
  await expect(
    exportCustomerData(
      { id: c.id, expectedVersion: 1, businessId: "other" },
      actor,
    ),
  ).rejects.toThrow();
  const first = await exportCustomerData(
    { id: c.id, expectedVersion: 1, limit: 1 },
    actor,
  );
  await db.booking.update({
    where: { id: first.bookings[0].id },
    data: { version: { increment: 1 } },
  });
  await expect(
    exportCustomerData(
      {
        id: c.id,
        expectedVersion: 1,
        cursor: first.nextCursor,
        expectedToken: first.expectedToken,
      },
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
});

it("removes card and linked contact copies while preserving booking versions, capacity decisions, events and abuse keys", async () => {
  const c = await customer(),
    other = await customer(),
    b = await upcoming(c.id, 11);
  await cancelBooking({ id: b.id, expectedVersion: b.version }, key(), actor);
  const s = (await listCapacity({}, actor)).suggestions.find(
    (x) => x.bookingId === b.id,
  )!;
  const source = {
    bookingId: s.bookingId,
    sourceVersion: s.sourceVersion,
    expectedToken: s.expectedToken,
  };
  const day = DateTime.fromISO(s.startsAt)
    .setZone("Europe/Stockholm")
    .toISODate()!;
  const decision = await decideCapacity(
    {
      ...source,
      campaign: {
        serviceId,
        title: "Syntetiskt bevarat utkast",
        discountPercent: 10,
        validFrom: day,
        validUntil: day,
      },
    },
    key(),
    actor,
    "draft",
  );
  const [unlinked] = await history(null),
    [otherBooking] = await history(other.id);
  const before = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
  const events = await db.bookingEvent.findMany({ where: { bookingId: b.id } });
  const input = await removal(c.id, c.version);
  await removeCustomerContact(input, key(), actor);
  const updated = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
  expect(updated).toMatchObject({
    name: REMOVED_CONTACT_NAME,
    email: REMOVED_CONTACT_EMAIL,
    phone: null,
    archived: true,
    version: 2,
  });
  expect(updated.contactRemovedAt).not.toBeNull();
  const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
  expect(after).toEqual({
    ...before,
    customerName: REMOVED_CONTACT_NAME,
    customerEmail: REMOVED_CONTACT_EMAIL,
    contactRemovedAt: updated.contactRemovedAt,
  });
  expect(
    await db.bookingEvent.findMany({ where: { bookingId: b.id } }),
  ).toEqual(events);
  for (const id of [unlinked, otherBooking])
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id } })).customerEmail,
    ).toBe(marker + "@example.test");
  const current = (await listCapacity({}, actor)).suggestions.find(
    (x) => x.bookingId === b.id,
  )!;
  expect(current.expectedToken).toBe(source.expectedToken);
  expect(current.campaign?.id).toBe(decision.campaignId);
  expect(current.status).toBe("draft");
  await expect(
    editCustomer(
      {
        id: c.id,
        expectedVersion: 2,
        name: "Återinfört namn",
        archived: false,
      },
      key(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(upcoming(c.id, 12)).rejects.toMatchObject({ status: 409 });
  await expect(
    db.customer.update({
      where: { id: c.id },
      data: { name: "Återinfört namn" },
    }),
  ).rejects.toThrow();
  await expect(
    db.booking.update({
      where: { id: b.id },
      data: { customerEmail: "restored@example.test" },
    }),
  ).rejects.toThrow();
  const log = await db.customerDataAction.findMany({
    where: { customerId: c.id },
  });
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({
    actorId: actor.id,
    action: "remove_contact",
    bookingCount: 1,
  });
  expect(JSON.stringify(log)).not.toContain(marker + "@example.test");
});

it("20 concurrent retries produce one contact action and replays never bypass current actor authorization", async () => {
  const c = await customer();
  await history(c.id, 2);
  const input = await removal(c.id, 1),
    request = key();
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      removeCustomerContact(input, request, actor),
    ),
  );
  expect(new Set(results.map((x) => JSON.stringify(x))).size).toBe(1);
  expect(
    await db.customerDataAction.count({
      where: { customerId: c.id, action: "remove_contact" },
    }),
  ).toBe(1);
  expect(await removeCustomerContact(input, request, actor)).toEqual(
    results[0],
  );
  await expect(
    removeCustomerContact(
      { ...input, expectedToken: "a".repeat(64) },
      request,
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await db.adminUser.update({
    where: { id: actor.id },
    data: { active: false },
  });
  try {
    await expect(
      removeCustomerContact(input, request, actor),
    ).rejects.toMatchObject({ status: 403 });
  } finally {
    await db.adminUser.update({
      where: { id: actor.id },
      data: { active: true },
    });
  }
});

it("blocks upcoming visits and invalidates a removal preview after new linked bookings or customer edits", async () => {
  const c = await customer(),
    b = await upcoming(c.id, 10);
  const before = await previewCustomerContactRemoval(
    { id: c.id, expectedVersion: 1 },
    actor,
  );
  expect(before.canRemove).toBe(false);
  expect(before.activeVisits).toBe(1);
  await expect(
    removeCustomerContact(
      {
        id: c.id,
        expectedVersion: 1,
        expectedToken: before.expectedToken,
        confirmed: true,
      },
      key(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await cancelBooking({ id: b.id, expectedVersion: b.version }, key(), actor);
  const input = await removal(c.id, 1);
  await history(c.id);
  await expect(
    removeCustomerContact(input, key(), actor),
  ).rejects.toMatchObject({ status: 409 });
  const current = await removal(c.id, 1);
  await editCustomer(
    {
      id: c.id,
      expectedVersion: 1,
      name: "Ändrat syntetiskt namn",
      archived: false,
    },
    key(),
    actor,
  );
  await expect(
    removeCustomerContact(current, key(), actor),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await db.customerDataAction.count({ where: { customerId: c.id } }),
  ).toBe(0);
});

it("serializes contact removal with customer edits and new linked bookings without restoring contact data", async () => {
  const c = await customer(),
    input = await removal(c.id, 1);
  const replies = await Promise.allSettled([
    removeCustomerContact(input, key(), actor),
    editCustomer(
      {
        id: c.id,
        expectedVersion: 1,
        name: "Samtidigt syntetiskt namn",
        archived: false,
      },
      key(),
      actor,
    ),
  ]);
  expect(replies.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  for (const r of replies)
    if (r.status === "rejected") expect(r.reason.status).toBe(409);
  const d = await customer(),
    data = await removal(d.id, 1);
  const mixed = await Promise.allSettled([
    removeCustomerContact(data, key(), actor),
    upcoming(d.id, 13),
  ]);
  expect(mixed.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  for (const r of mixed)
    if (r.status === "rejected") expect(r.reason.status).toBe(409);
  const row = await db.customer.findUniqueOrThrow({ where: { id: d.id } });
  expect(await db.booking.count({ where: { customerId: d.id } })).toBe(
    row.contactRemovedAt ? 0 : 1,
  );
  if (row.contactRemovedAt) expect(row.email).toBe(REMOVED_CONTACT_EMAIL);
});

it("refuses oversized scopes before touching contact data or audit logs", async () => {
  const c = await customer();
  await history(c.id, 1001);
  await expect(
    previewCustomerContactRemoval({ id: c.id, expectedVersion: 1 }, actor),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    exportCustomerData({ id: c.id, expectedVersion: 1 }, actor),
  ).rejects.toMatchObject({ status: 413 });
  expect(
    (await db.customer.findUniqueOrThrow({ where: { id: c.id } }))
      .contactRemovedAt,
  ).toBeNull();
  expect(
    await db.customerDataAction.count({ where: { customerId: c.id } }),
  ).toBe(0);
});

it("scrubs legacy email quota copies without resetting the daily cap or booking replays", async () => {
  const c = await customer();
  const contact = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
  const client = `lifecycle-client:${marker}`;
  const day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 5 })
    .startOf("day");
  const inputs = [9, 10, 11, 12].map((hour) => ({
    customerId: c.id,
    serviceId,
    staffId,
    start: day.set({ hour }).toUTC().toISO()!,
  }));
  const keys = [key(), key(), key()];
  const created = [];
  for (let i = 0; i < 3; i++)
    created.push(
      await createBooking(inputs[i], keys[i], client, LOCAL_WORKSPACE_ACTOR),
    );
  const hash = hashedEmailCapKey(emailCapKey(contact.email));
  expect(created.every((b) => b.emailCapKey === hash)).toBe(true);
  expect(hash).not.toContain(contact.email);
  // Simulate an existing row written by the older application. Both formats
  // must count before removal; hashing must never refund a booking budget.
  await db.booking.update({
    where: { id: created[0].id },
    data: { emailCapKey: emailCapKey(contact.email) },
  });
  await expect(
    createBooking(inputs[3], key(), client, LOCAL_WORKSPACE_ACTOR),
  ).rejects.toMatchObject({ status: 429 });
  for (const b of created)
    await cancelBooking({ id: b.id, expectedVersion: b.version }, key(), actor);
  const before = await db.booking.findMany({
    where: { customerId: c.id },
    orderBy: { id: "asc" },
  });
  const events = await db.bookingEvent.findMany({
    where: { bookingId: { in: created.map((b) => b.id) } },
    orderBy: { id: "asc" },
  });
  await removeCustomerContact(await removal(c.id, c.version), key(), actor);
  const removed = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
  const after = await db.booking.findMany({
    where: { customerId: c.id },
    orderBy: { id: "asc" },
  });
  for (let i = 0; i < after.length; i++) {
    expect(after[i]).toEqual({
      ...before[i],
      customerName: REMOVED_CONTACT_NAME,
      customerEmail: REMOVED_CONTACT_EMAIL,
      emailCapKey: hash,
      contactRemovedAt: removed.contactRemovedAt,
    });
    expect(JSON.stringify(after[i])).not.toContain(contact.email);
    expect(JSON.stringify(after[i])).not.toContain(contact.name);
  }
  expect(
    await db.bookingEvent.findMany({
      where: { bookingId: { in: created.map((b) => b.id) } },
      orderBy: { id: "asc" },
    }),
  ).toEqual(events);
  const replay = await createBooking(
    inputs[0],
    keys[0],
    client,
    LOCAL_WORKSPACE_ACTOR,
  );
  expect(replay.id).toBe(created[0].id);
  expect(replay.customerEmail).toBe(REMOVED_CONTACT_EMAIL);
  expect(await db.booking.count({ where: { customerId: c.id } })).toBe(3);
  const [local, domain] = contact.email.split("@");
  await expect(
    createBooking(
      {
        serviceId,
        staffId,
        start: inputs[3].start,
        customerName: "Ny påhittad kontakt",
        customerEmail: `${local}+retry@${domain}`,
      },
      key(),
      client,
    ),
  ).rejects.toMatchObject({ status: 429 });
});

afterAll(async () => {
  const decisions = await db.capacityDecision.findMany({
    where: { booking: { staffId } },
    select: { id: true, campaignId: true },
  });
  await db.capacityDecision.deleteMany({
    where: { id: { in: decisions.map((d) => d.id) } },
  });
  await db.campaign.deleteMany({
    where: {
      id: {
        in: decisions.flatMap((d) => (d.campaignId ? [d.campaignId] : [])),
      },
    },
  });
  await db.customerDataAction.deleteMany({
    where: { customerId: { in: customers } },
  });
  await db.booking.deleteMany({ where: { staffId } });
  await db.customer.deleteMany({ where: { id: { in: customers } } });
  await db.workspaceRequest.deleteMany({ where: { key: { in: ledger } } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.adminUser.deleteMany({
    where: { id: { in: [actor.id, foreign.id] } },
  });
  await db.$disconnect();
});
