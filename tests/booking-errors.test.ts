import { afterEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { insertBooking } from "../src/lib/domain";
import { DomainError } from "../src/lib/errors";

afterEach(() => vi.restoreAllMocks());
const data = {
  id: "synthetic",
  businessId: "demo",
  staffId: "synthetic",
  serviceId: "massage",
  startsAt: new Date("2030-01-01T09:00Z"),
  endsAt: new Date("2030-01-01T09:30Z"),
  customerName: "Syntetisk",
  customerEmail: "synthetic@example.test",
  idempotencyKey: null,
  requestHash: null,
};
it.each(["23P01", "40P01", "40001"])(
  "mappar SQLSTATE %s till säker bokningskonflikt",
  async (code) => {
    vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("synthetic", {
        code: "P2010",
        clientVersion: "6",
        meta: { code },
      }),
    );
    await expect(insertBooking(db, data)).rejects.toEqual(
      new DomainError("Tiden är inte tillgänglig"),
    );
  },
);
it("döljer inte andra databasfel som bokningskonflikter", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("synthetic", {
    code: "P2010",
    clientVersion: "6",
    meta: { code: "08006" },
  });
  vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(error);
  await expect(insertBooking(db, data)).rejects.toBe(error);
});

it.each(["23P01", "40P01", "40001"])(
  "mappar Prisma 7:s strukturerade adapterfel %s",
  async (originalCode) => {
    vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("synthetic", {
        code: "P2010",
        clientVersion: "7",
        meta: { driverAdapterError: { cause: { originalCode } } },
      }),
    );
    await expect(insertBooking(db, data)).rejects.toEqual(
      new DomainError("Tiden är inte tillgänglig"),
    );
  },
);

it("döljer inte andra adapterfel även om meddelandet innehåller en SQLSTATE", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("23P01", {
    code: "P2010",
    clientVersion: "7",
    meta: { driverAdapterError: { cause: { originalCode: "08006" } } },
  });
  vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(error);
  await expect(insertBooking(db, data)).rejects.toBe(error);
});
