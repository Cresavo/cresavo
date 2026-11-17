import { z } from "zod";
import { addDays, diffDays, formatTime } from "../data/dates";
import { freeStarts, openingFor } from "../data/slots";
import type { Booking, DemoState, ModuleKey, StaffId } from "../data/types";
import { buildOverview } from "../finance/overview";
import { words } from "../i18n";
import { buildCustomerStats, findService, fullName } from "../selectors";
import { forecastInput, ruleForecast } from "../stock/forecast";
import { SALON_TIMEZONE } from "./clock";
import { field, readTool, ToolError } from "./define";
import { BRAND } from "../brand";

// Read tools. Customers are minimised: name and visit history only, never
// phone, e-mail, birthday, notes, tags or journal entries.

const MAX_DAYS = 14;
const MAX_CUSTOMERS = 50;

function requireModule(state: DemoState, key: ModuleKey) {
  if (!state.modules[key]) throw new ToolError("module_off", `The ${key} module is switched off for this business.`);
}

const staffName = (state: DemoState, id: StaffId) => state.staff.find((s) => s.id === id)?.firstName ?? id;

function customerRef(state: DemoState, id: string) {
  const customer = state.customers.find((c) => c.id === id);
  return { id, name: customer ? fullName(customer) : "Unknown" };
}

function bookingView(state: DemoState, booking: Booking) {
  return {
    id: booking.id,
    date: booking.date,
    start: formatTime(booking.start),
    end: formatTime(booking.start + booking.duration),
    status: booking.status,
    service: { id: booking.serviceId, name: findService(state, booking.serviceId)?.name ?? booking.serviceId },
    staff: { id: booking.staffId, name: staffName(state, booking.staffId) },
    customer: customerRef(state, booking.customerId),
    priceSek: booking.price,
    source: booking.source,
  };
}

export const getBusiness = readTool({
  name: "get_business",
  title: "Business profile",
  description: "Name, area, time zone, opening hours, staff and which modules are switched on. Start here.",
  input: z.object({}).strict(),
  run: ({ state, clock }) => ({
    name: state.salon.name,
    tagline: state.salon.tagline,
    area: state.salon.area,
    timezone: SALON_TIMEZONE,
    currency: "SEK",
    today: clock.today,
    now: formatTime(clock.minutes),
    openingHours: [1, 2, 3, 4, 5, 6, 0].map((day) => {
      const hours = state.salon.hours[day];
      return { day: words.weekdays[day], open: hours ? formatTime(hours.open) : null, close: hours ? formatTime(hours.close) : null };
    }),
    staff: state.staff.map((s) => ({ id: s.id, name: s.firstName, title: s.title })),
    modules: Object.entries(state.modules).filter(([, on]) => on).map(([key]) => key),
    demo: `Synthetic demo data, regenerated every day. Changes need the owner's approval in ${BRAND.name}.`,
  }),
});

export const listBookings = readTool({
  name: "list_bookings",
  title: "Bookings",
  description: `Bookings from one day up to ${MAX_DAYS} days, sorted by time. Defaults to today. Cancelled bookings only with includeCancelled.`,
  input: z
    .object({
      from: field.date.optional().describe("First day, YYYY-MM-DD. Default: today."),
      to: field.date.optional().describe("Last day (inclusive). Default: same as from."),
      staffId: field.staffId.optional(),
      includeCancelled: z.boolean().optional(),
    })
    .strict(),
  run: ({ state, clock }, input) => {
    const from = input.from ?? clock.today;
    const to = input.to ?? from;
    if (to < from || diffDays(to, from) >= MAX_DAYS) throw new ToolError("invalid_range", `Use a range of 1 to ${MAX_DAYS} days with from <= to.`);
    const bookings = state.bookings
      .filter((b) => b.date >= from && b.date <= to && (!input.staffId || b.staffId === input.staffId) && (input.includeCancelled || b.status !== "cancelled"))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.staffId.localeCompare(b.staffId));
    return { from, to, count: bookings.length, bookings: bookings.map((b) => bookingView(state, b)) };
  },
});

export const getAvailability = readTool({
  name: "get_availability",
  title: "Free times",
  description: "Free start times (15-minute steps) for a service on one day, per staff member. Times already passed today are left out.",
  input: z.object({ serviceId: field.id, date: field.date, staffId: field.staffId.optional() }).strict(),
  run: ({ state, clock }, input) => {
    const service = findService(state, input.serviceId);
    if (!service) throw new ToolError("not_found", "Unknown serviceId. Use list_services.");
    if (input.date < clock.today || diffDays(input.date, clock.today) > 90) throw new ToolError("invalid_range", "Pick a day from today up to 90 days ahead.");
    const after = input.date === clock.today ? clock.minutes : 0;
    const staffIds = service.staffIds.filter((id) => !input.staffId || id === input.staffId);
    return {
      date: input.date,
      open: openingFor(state.salon, input.date) !== null,
      service: { id: service.id, name: service.name, durationMin: service.duration, priceSek: service.price },
      staff: staffIds.map((id) => ({ id, name: staffName(state, id), starts: freeStarts(state, id, input.date, service.duration, { after }).map(formatTime) })),
    };
  },
});

export const listCustomers = readTool({
  name: "list_customers",
  title: "Customers",
  description: `Customers by name with visit history (minimised: no phone, e-mail, birthday, notes or journal). Up to ${MAX_CUSTOMERS} at a time.`,
  input: z
    .object({
      query: z.string().trim().max(60).optional().describe("Part of a name."),
      limit: z.number().int().min(1).max(MAX_CUSTOMERS).optional(),
    })
    .strict(),
  run: ({ state, clock }, input) => {
    const stats = buildCustomerStats(state, clock.today);
    const query = input.query?.toLowerCase();
    const matching = state.customers.filter((c) => !query || fullName(c).toLowerCase().includes(query));
    return {
      total: matching.length,
      customers: matching.slice(0, input.limit ?? 20).map((c) => {
        const s = stats.get(c.id);
        return {
          id: c.id,
          name: fullName(c),
          regular: c.isRegular,
          customerSince: c.since,
          visits: s?.visits ?? 0,
          lastVisit: s?.lastVisit ?? null,
          nextBooking: s?.nextBooking ? { id: s.nextBooking.id, date: s.nextBooking.date, start: formatTime(s.nextBooking.start) } : null,
        };
      }),
    };
  },
});

export const listServices = readTool({
  name: "list_services",
  title: "Services and prices",
  description: "The price list: every service with duration, price in SEK and who performs it.",
  input: z.object({}).strict(),
  run: ({ state }) => ({
    services: state.services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      durationMin: s.duration,
      priceSek: s.price,
      staff: s.staffIds.map((id) => ({ id, name: staffName(state, id) })),
      description: s.description,
    })),
  }),
});

export const getStock = readTool({
  name: "get_stock",
  title: "Stock",
  description: "Products in stock with reorder level, quantity on order and days left at the current pace.",
  input: z.object({ lowOnly: z.boolean().optional() }).strict(),
  run: ({ state, clock }, input) => {
    requireModule(state, "stock");
    const items = state.stock
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        inStock: item.inStock,
        reorderAt: item.reorderAt,
        onOrder: item.onOrder,
        low: item.inStock <= item.reorderAt,
        daysLeft: ruleForecast(forecastInput(state, item, clock.today)).daysRemaining,
        supplier: item.supplier,
      }))
      .filter((item) => !input.lowOnly || item.low);
    return { items };
  },
});

export const getFinance = readTool({
  name: "get_finance",
  title: "Finance figures",
  description: "Revenue, visits, cancellations, no-shows and new/returning customers for the period so far, next to the same stretch of the period before. Amounts in SEK.",
  input: z.object({ period: z.enum(["day", "week", "month", "year"]).optional().describe("Default: month.") }).strict(),
  run: ({ state, clock }, input) => {
    requireModule(state, "finance");
    const period = input.period ?? "month";
    const overview = buildOverview(state, period, clock);
    const range = (r: { start: string; end: string }) => ({ from: r.start, to: addDays(r.end, -1) });
    return {
      period,
      current: { ...range(overview.ranges.current), ...overview.current },
      previous: { ...range(overview.ranges.previous), ...overview.previous },
      topServices: overview.treatments.map((row) => ({ id: row.id, name: findService(state, row.id)?.name ?? row.id, visits: row.visits, previousVisits: row.previous })),
    };
  },
});

export const listCampaigns = readTool({
  name: "list_campaigns",
  title: "Campaigns",
  description: "Campaigns with status, dates, discount, channels and simulated results.",
  input: z.object({}).strict(),
  run: ({ state }) => {
    requireModule(state, "campaigns");
    return {
      campaigns: state.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        from: c.from,
        to: c.to,
        discountPercent: c.discountPercent,
        services: c.serviceIds.map((id) => findService(state, id)?.name ?? id),
        channels: c.channels,
        results: c.stats ?? null,
      })),
    };
  },
});

export const readTools = [getBusiness, listBookings, getAvailability, listCustomers, listServices, getStock, getFinance, listCampaigns];
