import { z } from "zod";
import { db } from "./db";
import { localDay, parseDay, slotsForDay } from "./time";
const businessId = "demo", staffId = "staff-demo";
const date = z.string().refine(v => { try { parseDay(v); return true; } catch { return false; } }, "Ogiltigt datum");
export const campaignSchema = z.object({ serviceId: z.string().min(1), title: z.string().trim().min(1).max(100), discountPercent: z.number().int().min(1).max(100), validFrom: date, validUntil: date }).refine(v => v.validFrom <= v.validUntil, "Slutdatum före startdatum");
const bookingSchema = z.object({ serviceId: z.string().min(1), start: z.iso.datetime({ offset: true }), customerName: z.string().trim().min(2).max(80), customerEmail: z.email().max(254) });
export async function listServices() { return db.service.findMany({ where: { businessId }, orderBy: { name: "asc" } }); }
async function serviceById(id: string) { const service = await db.service.findFirst({ where: { id, businessId } }); if (!service) throw new Error("Tjänsten finns inte"); return service; }
export async function getAvailability(serviceId: string, day: string) {
  date.parse(day); const service = await serviceById(serviceId);
  const candidates = slotsForDay(day, service.duration);
  if (!candidates.length) return [];
  const start = parseDay(day).toUTC().toJSDate(), end = parseDay(day).plus({ days: 1 }).toUTC().toJSDate();
  const bookings = await db.booking.findMany({ where: { businessId, staffId, startsAt: { lt: end }, endsAt: { gt: start } } });
  return candidates.filter(s => !bookings.some(b => s.getTime() < b.endsAt.getTime() && s.getTime() + service.duration * 60000 > b.startsAt.getTime())).map(s => s.toISOString());
}
export async function createBooking(input: unknown) {
  const v = bookingSchema.parse(input), service = await serviceById(v.serviceId), start = new Date(v.start);
  if (!Number.isFinite(start.getTime()) || !(await getAvailability(service.id, localDay(start))).includes(start.toISOString())) throw new Error("Tiden är inte tillgänglig");
  try { return await db.booking.create({ data: { businessId, staffId, serviceId: service.id, startsAt: start, endsAt: new Date(start.getTime() + service.duration * 60000), customerName: v.customerName, customerEmail: v.customerEmail } }); }
  catch (e) { if (String(e).includes("booking_no_overlap") || String(e).includes("23P01")) throw new Error("Tiden är inte tillgänglig"); throw e; }
}
export async function listBookings() { return db.booking.findMany({ where: { businessId }, include: { service: true }, orderBy: { startsAt: "asc" } }); }
export async function createCampaign(input: unknown) { const v = campaignSchema.parse(input); await serviceById(v.serviceId); return db.campaign.create({ data: { ...v, businessId } }); }
export async function listCampaigns() { return db.campaign.findMany({ where: { businessId }, include: { service: true }, orderBy: { validFrom: "desc" } }); }
export async function publicCampaigns(day: string) { date.parse(day); return db.campaign.findMany({ where: { businessId, published: true, validUntil: { gte: day } }, include: { service: true } }); }
export async function publishCampaign(id: string) { const result = await db.campaign.updateMany({ where: { id, businessId }, data: { published: true } }); if (!result.count) throw new Error("Utkastet finns inte"); }
