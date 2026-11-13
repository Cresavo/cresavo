import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { campaignSchema, createCampaign, getAvailability } from "./domain";
import { DomainError } from "./errors";
import { dateSchema } from "./validation";
import { localDay, parseDay, ZONE } from "./time";
import {
  assertWorkspaceActor,
  lockConfiguration,
  workspaceWrite,
  type WorkspaceActor,
} from "./workspace-write";

const id = z.string().min(1).max(128);
export const capacityListSchema = z
  .object({
    from: dateSchema.optional(),
    days: z.number().int().min(1).max(7).default(7),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict();
export const capacitySourceSchema = z
  .object({
    bookingId: id,
    sourceVersion: z.number().int().positive(),
    expectedToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const capacityDraftSchema = capacitySourceSchema
  .extend({ campaign: campaignSchema })
  .strict();
const sourceSelect = {
  id: true,
  businessId: true,
  serviceId: true,
  staffId: true,
  startsAt: true,
  endsAt: true,
  duration: true,
  buffer: true,
  version: true,
  status: true,
  events: {
    where: { action: "cancel" },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, createdAt: true },
  },
} satisfies Prisma.BookingSelect;
type Source = Prisma.BookingGetPayload<{ select: typeof sourceSelect }>;
const hash = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
const stale = () =>
  new DomainError("Förslaget är inte aktuellt. Uppdatera översikten.", 409);

// Public projections never select customer fields. The cancelled booking is a
// stable source, not a reservation. Current capacity is always recomputed.
async function project(
  tx: Prisma.TransactionClient,
  source: Source,
  now: Date,
) {
  const [service, staff, decision] = await Promise.all([
    tx.service.findFirst({ where: { id: source.serviceId, businessId } }),
    tx.staff.findFirst({
      where: { id: source.staffId, businessId },
      select: { id: true, name: true, version: true, active: true },
    }),
    tx.capacityDecision.findUnique({
      where: {
        businessId_bookingId_sourceVersion: {
          businessId,
          bookingId: source.id,
          sourceVersion: source.version,
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            published: true,
            validFrom: true,
            validUntil: true,
            discountPercent: true,
            title: true,
          },
        },
      },
    }),
  ]);
  let available = false;
  const futureEnd = DateTime.fromJSDate(now, { zone: ZONE })
    .startOf("day")
    .plus({ days: 7 })
    .toMillis();
  if (
    source.status === "cancelled" &&
    source.events.length &&
    service?.active &&
    staff?.active &&
    source.startsAt.getTime() > now.getTime() &&
    source.startsAt.getTime() < futureEnd &&
    (service.duration + service.buffer) * 60000 <=
      source.endsAt.getTime() - source.startsAt.getTime()
  ) {
    try {
      available = (
        await getAvailability(
          service.id,
          localDay(source.startsAt),
          tx,
          staff.id,
        )
      ).includes(source.startsAt.toISOString());
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  const token = hash({
    source: source.id,
    version: source.version,
    start: source.startsAt.toISOString(),
    end: source.endsAt.toISOString(),
    serviceVersion: service?.version,
    staffVersion: staff?.version,
    cancellation: source.events[0]?.id,
  });
  return {
    bookingId: source.id,
    sourceVersion: source.version,
    expectedToken: token,
    serviceId: source.serviceId,
    serviceName: service?.name ?? "Behandlingen är inte tillgänglig",
    staffId: source.staffId,
    staffName: staff?.name ?? "Medarbetaren är inte tillgänglig",
    startsAt: source.startsAt.toISOString(),
    endsAt: new Date(
      source.startsAt.getTime() +
        (service
          ? service.duration + service.buffer
          : source.duration + source.buffer) *
          60000,
    ).toISOString(),
    duration: service?.duration ?? source.duration,
    priceOre: service?.priceOre ?? null,
    available,
    status: decision?.outcome ?? "new",
    reason: available
      ? "En framtida avbokning har lämnat en bokningsbar tid."
      : "Tiden är inte längre bokningsbar med aktuella regler.",
    calendarHref: `/admin?date=${localDay(source.startsAt)}&view=day&staffId=${encodeURIComponent(source.staffId)}`,
    campaign: decision?.campaign ?? null,
    decidedAt: decision?.createdAt.toISOString() ?? null,
  };
}

async function sourceById(
  tx: Prisma.TransactionClient,
  bookingId: string,
  version: number,
) {
  const source = await tx.booking.findFirst({
    where: { id: bookingId, businessId },
    select: sourceSelect,
  });
  if (
    !source ||
    source.version !== version ||
    source.status !== "cancelled" ||
    !source.events.length
  )
    throw stale();
  return source;
}

export async function listCapacity(input: unknown, actor: WorkspaceActor) {
  const v = capacityListSchema.parse(input);
  const now = new Date(),
    today = parseDay(localDay(now));
  const from = v.from ? parseDay(v.from) : today;
  const end = from.plus({ days: v.days });
  if (from < today || end > today.plus({ days: 7 })) throw stale();
  return db.$transaction(
    async (tx) => {
      await lockConfiguration(tx);
      await assertWorkspaceActor(tx, actor);
      const sources = await tx.booking.findMany({
        where: {
          businessId,
          status: "cancelled",
          startsAt: { gte: from.toJSDate(), lt: end.toJSDate() },
          events: { some: { action: "cancel" } },
        },
        select: sourceSelect,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: v.limit + 1,
      });
      const suggestions = [];
      for (const source of sources.slice(0, v.limit))
        suggestions.push(await project(tx, source, now));
      return {
        fetchedAt: now.toISOString(),
        from: from.toISODate()!,
        until: end.minus({ days: 1 }).toISODate()!,
        suggestions,
        hasMore: sources.length > v.limit,
      };
    },
    { timeout: 30000 },
  );
}

export async function inspectCapacity(
  input: unknown,
  actor: WorkspaceActor,
  previewDraft = false,
) {
  const v = previewDraft
    ? capacityDraftSchema.parse(input)
    : capacitySourceSchema.parse(input);
  return db.$transaction(async (tx) => {
    await lockConfiguration(tx);
    await assertWorkspaceActor(tx, actor);
    const result = await project(
      tx,
      await sourceById(tx, v.bookingId, v.sourceVersion),
      new Date(),
    );
    if (!result.available || result.expectedToken !== v.expectedToken)
      throw stale();
    if (previewDraft) {
      const campaign = (v as z.infer<typeof capacityDraftSchema>).campaign;
      validateCampaignScope(
        campaign,
        result.serviceId,
        localDay(new Date(result.startsAt)),
      );
    }
    return { calendarHref: result.calendarHref };
  });
}

function validateCampaignScope(
  campaign: z.infer<typeof campaignSchema>,
  serviceId: string,
  day: string,
) {
  if (
    campaign.serviceId !== serviceId ||
    campaign.validFrom > day ||
    campaign.validUntil < day
  )
    throw stale();
}

export async function decideCapacity(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
  action: "dismiss" | "draft",
) {
  const v =
    action === "draft"
      ? capacityDraftSchema.parse(input)
      : capacitySourceSchema.parse(input);
  return workspaceWrite(
    `capacity_${action}`,
    v,
    requestId,
    actor,
    false,
    async (tx) => {
      const source = await sourceById(tx, v.bookingId, v.sourceVersion);
      // Same per-staff/local-day key as createBooking. No booking is reserved.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:staff:${source.staffId}:${localDay(source.startsAt)}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:capacity:${source.id}:${source.version}`}))`;
      const identity = {
        businessId,
        bookingId: source.id,
        sourceVersion: source.version,
      };
      const existing = await tx.capacityDecision.findUnique({
        where: { businessId_bookingId_sourceVersion: identity },
      });
      const payloadHash =
        action === "draft"
          ? hash((v as z.infer<typeof capacityDraftSchema>).campaign)
          : null;
      if (existing) {
        if (
          existing.outcome !== (action === "draft" ? "draft" : "dismissed") ||
          existing.payloadHash !== payloadHash
        )
          throw new DomainError(
            "Förslaget har redan hanterats med andra villkor.",
            409,
          );
        return {
          id: existing.id,
          campaignId: existing.campaignId,
          status: existing.outcome,
        };
      }
      const current = await project(tx, source, new Date());
      if (!current.available || current.expectedToken !== v.expectedToken)
        throw stale();
      let campaignId: string | null = null;
      if (action === "draft") {
        const campaign = (v as z.infer<typeof capacityDraftSchema>).campaign;
        validateCampaignScope(
          campaign,
          source.serviceId,
          localDay(source.startsAt),
        );
        campaignId = (await createCampaign(campaign, tx)).id;
      }
      const decision = await tx.capacityDecision.create({
        data: {
          ...identity,
          outcome: action === "draft" ? "draft" : "dismissed",
          campaignId,
          payloadHash,
        },
      });
      return { id: decision.id, campaignId, status: decision.outcome };
    },
  );
}
