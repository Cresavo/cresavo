import { DateTime } from "luxon";
import { z } from "zod";
import { assertTestDatabase } from "../../../scripts/test-db-guard.mjs";
import { db } from "../../lib/db";
import { DEMO_BUSINESS_ID as businessId } from "../../lib/config";
import { listCalendar } from "../../lib/calendar";
import { getAvailability, listServices } from "../../lib/domain";
import { listStaff } from "../../lib/workspace-config";
import { listCapacity } from "../../lib/capacity";
import { LOCAL_WORKSPACE_ACTOR } from "../../lib/workspace-write";
import { dateSchema } from "../../lib/validation";
import { DomainError } from "../../lib/errors";
import { parseDay, localDay } from "../../lib/time";

export function assertOwnerCard(
  env: Record<string, string | undefined> = process.env,
  args = process.argv,
) {
  if (
    env.BOOKING_OWNER_CARD_DEMO !== "1" ||
    !args.includes("--admin") ||
    !args.includes("--workday-card") ||
    args.includes("--allow-bookings") ||
    args.includes("--allow-workspace") ||
    args.includes("--capacity-only") ||
    !env.SESSION_SECRET ||
    env.SESSION_SECRET.length < 32 ||
    env.NODE_ENV === "production" ||
    Object.keys(env).some(
      (k) => (k.startsWith("VERCEL") || k === "NOW_REGION") && env[k],
    )
  )
    throw new Error("OWNER_CARD_DEMO_REFUSED");
  try {
    assertTestDatabase(env.DATABASE_URL);
    ownerOrigin(env.BOOKING_OWNER_WEB_ORIGIN);
  } catch {
    throw new Error("OWNER_CARD_DEMO_REFUSED");
  }
}
function ownerOrigin(value = "http://localhost:3187") {
  const u = new URL(value);
  if (
    u.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error();
  return u.origin;
}
export const workdaySchema = z
  .object({
    date: dateSchema.optional(),
    staffId: z.string().min(1).max(128).optional(),
    serviceId: z.string().min(1).max(128).optional(),
    cursor: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function ownerWorkday(input: unknown) {
  assertOwnerCard();
  const v = workdaySchema.parse(input),
    today = parseDay(localDay(new Date()));
  const day = parseDay(v.date ?? today.toISODate()!);
  if (day < today.minus({ days: 7 }) || day > today.plus({ days: 27 }))
    throw new DomainError(
      "Välj en dag från förra veckan till de kommande 28 dagarna.",
    );
  const date = day.toISODate()!,
    now = new Date();
  const [people, services] = await Promise.all([listStaff(), listServices()]);
  const staff = people.map(({ id, name, serviceIds }) => ({
    id,
    name,
    serviceIds,
  }));
  const person = staff.find((s) => s.id === (v.staffId ?? staff[0]?.id));
  if (v.staffId && !person) throw new DomainError("Välj en aktiv medarbetare.");
  const treatments = services
    .filter((s) => person?.serviceIds.includes(s.id))
    .map(({ id, name, duration, priceOre }) => ({
      id,
      name,
      duration,
      priceOre,
    }));
  const service = treatments.find(
    (s) => s.id === (v.serviceId ?? treatments[0]?.id),
  );
  if (v.serviceId && !service)
    throw new DomainError("Välj en behandling som medarbetaren utför.");
  const calendar = person
    ? await listCalendar({
        from: date,
        to: date,
        staffId: person.id,
        limit: 20,
        ...(v.cursor && { cursor: v.cursor }),
      })
    : { bookings: [], nextCursor: null };
  const bookings = calendar.bookings.map(
    ({ id, serviceName, startsAt, endsAt, duration, priceOre, status }) => ({
      id,
      serviceName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      duration,
      priceOre,
      status,
    }),
  );
  const next = person
    ? await db.booking.findFirst({
        where: {
          businessId,
          staffId: person.id,
          status: "confirmed",
          startsAt: {
            gte: day.toJSDate(),
            lt: day.plus({ days: 1 }).toJSDate(),
          },
          endsAt: { gt: now },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: { id: true, serviceName: true, startsAt: true, duration: true },
      })
    : null;
  const slots =
    person && service && day >= today
      ? await getAvailability(service.id, date, db, person.id)
      : [];
  const capacity =
    day >= today && day < today.plus({ days: 7 })
      ? await listCapacity(
          { from: date, days: 1, limit: 3 },
          LOCAL_WORKSPACE_ACTOR,
        )
      : null;
  const origin = ownerOrigin(process.env.BOOKING_OWNER_WEB_ORIGIN);
  return {
    demo: true,
    timezone: "Europe/Stockholm",
    actor: "Betrodd lokal ägarprofil – demo",
    date,
    today: today.toISODate()!,
    firstDate: today.minus({ days: 7 }).toISODate()!,
    lastDate: today.plus({ days: 27 }).toISODate()!,
    staff,
    selectedStaff: person ?? null,
    services: treatments,
    selectedService: service ?? null,
    bookings,
    nextCursor: calendar.nextCursor,
    nextVisit: next ? { ...next, startsAt: next.startsAt.toISOString() } : null,
    slots: slots.slice(0, 12),
    moreSlots: slots.length > 12,
    capacity: capacity
      ? {
          suggestions: capacity.suggestions.map((s) => ({
            bookingId: s.bookingId,
            available: s.available,
          })),
          hasMore: capacity.hasMore,
        }
      : null,
    links: {
      calendar: `${origin}/admin?date=${date}${person ? `&staffId=${encodeURIComponent(person.id)}` : ""}`,
      overview: `${origin}/admin/overview${capacity ? `?from=${date}&days=1` : ""}`,
      bookings: Object.fromEntries(
        bookings.map((b) => [
          b.id,
          `${origin}/admin/bookings/${encodeURIComponent(b.id)}`,
        ]),
      ),
    },
    checkedAt: DateTime.now().toUTC().toISO()!,
    notice:
      "Endast läsning. Vanlig individuell admininloggning krävs för ändringar. Inga kundkontakter lämnas till assistenten.",
  };
}
