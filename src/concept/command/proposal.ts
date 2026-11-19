import { preferredStaffOf, rememberedPreference } from "../assistant/memory";
import { addDays } from "../data/dates";
import { freeStarts, isFree, needOf, type Need } from "../data/slots";
import type { Booking, DateKey, DemoState, Service, StaffId, StockItem } from "../data/types";
import type { DemoAction } from "../actions";
import { t, tc } from "../i18n";
import { agoText, formatAmount, formatDayLong, formatDayMonth, formatDuration, formatMoney, formatTime } from "../i18n/format";
import type { IntentParams, IntentResult } from "../intent";
import { blockingModule, moduleById, type ModuleManifest } from "../modules/registry";
import { buildCustomerStats, findCustomer, findService, fullName, PRODUCTS_ROW, revenueBetween } from "../selectors";
import { validServicePrice } from "../services/edit";
import { forecastInput, ruleForecast, supplierOf } from "../stock/forecast";
import { findProducts } from "../stock/match";
import { buildOrders, purchaseQuantity } from "../stock/purchase";
import { sellable } from "../stock/sales";
import { waitlistCount, waitlistNotice } from "../studio/booking/waitlist-notice";
import { parseCampaignRequest, studioHref, type CampaignPrefill } from "../campaigns/prefill";
import { canChangeBooking, canCommand, type Role } from "../ops/access";
import type { PageConfig } from "../page/config";
import { questionText } from "./questions";
import { clarifyChoices, type Retry } from "./clarify";
import { insightFor, type Insight } from "./insight";
import { pageProposal } from "./page-proposal";
import { closeSalonProposal, shiftProposal, staffOffProposal } from "./schedule-proposal";

// Turns what the interpreter understood into something the owner can review.
// Nothing here changes data: a "change" proposal carries one store action that
// runs only when the owner approves it.

export interface Clock {
  today: DateKey;
  minutes: number;
}

export interface ChangeRow {
  label: string;
  before?: string;
  after: string;
}

export type Choice = { label: string; proposal: Proposal } | Retry;

export type Proposal =
  | { kind: "change"; title: string; subtitle?: string; rows: ChangeRow[]; action: DemoAction; toast: string; destructive?: boolean; /** The booking page before and after, for a design change. */ preview?: { before: PageConfig; after: PageConfig } }
  | { kind: "choose"; title: string; choices: Choice[] }
  | { kind: "stock"; title: string; items: { id: string; name: string; left: string; unit: string; detail?: string; low: boolean }[] }
  | { kind: "revenue"; title: string; range: string; total: number; visits: number; bars: { id: string; label: string; value: number }[] }
  | Insight
  | { kind: "customers"; title: string; total: number; items: { id: string; name: string; detail: string }[] }
  | { kind: "message"; text: string; link?: { href: string; label: string } };

const STUDIO_HREF = "/studio/more/campaigns/new";
const MAX_SLOT_CHOICES = 3;
const MAX_LISTED_CUSTOMERS = 8;
const MAX_LISTED_PRODUCTS = 6;
const NOON = 12 * 60;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const message = (text: string, link?: { href: string; label: string }): Proposal => ({ kind: "message", text, link });
const whenText = (date: DateKey, start: number) => `${formatDayLong(date)} ${formatTime(start)}`;

export interface Candidate {
  staffId: StaffId;
  start: number;
}

/** Up to three free starts: closest to the wanted time, or spread through the part of the day. */
export function pickCandidates(state: DemoState, staffIds: StaffId[], need: Need, date: DateKey, clock: Clock, wanted: { near?: number; period?: "morning" | "afternoon"; ignoreId?: string }): Candidate[] {
  const after = date === clock.today ? clock.minutes : 0;
  const all = staffIds.flatMap((staffId) => freeStarts(state, staffId, date, need, { after, ignoreId: wanted.ignoreId }).map((start) => ({ staffId, start })));
  const inPeriod = all.filter(({ start }) => !wanted.period || (wanted.period === "morning" ? start < NOON : start >= NOON));
  if (wanted.near !== undefined) {
    const near = wanted.near;
    return inPeriod.sort((a, b) => Math.abs(a.start - near) - Math.abs(b.start - near) || a.start - b.start).slice(0, MAX_SLOT_CHOICES).sort((a, b) => a.start - b.start);
  }
  const spread: Candidate[] = [];
  for (const candidate of inPeriod.sort((a, b) => a.start - b.start)) {
    const last = spread.at(-1);
    if (!last || candidate.start - last.start >= 60) spread.push(candidate);
    if (spread.length === MAX_SLOT_CHOICES) break;
  }
  return spread;
}

function staffName(state: DemoState, staffId: StaffId) {
  return state.staff.find((s) => s.id === staffId)?.firstName ?? staffId;
}

/** Pick one or let the owner pick: a single candidate goes straight to its proposal. */
function chooseSlot(state: DemoState, candidates: Candidate[], title: string, date: DateKey, build: (c: Candidate) => Proposal): Proposal {
  if (!candidates.length) return message(t("command.noFreeTime", { day: formatDayLong(date) }));
  if (candidates.length === 1) return build(candidates[0]);
  const showStaff = new Set(candidates.map((c) => c.staffId)).size > 1;
  return {
    kind: "choose",
    title,
    choices: candidates.map((c) => ({
      label: showStaff ? t("command.slotWith", { time: formatTime(c.start), name: staffName(state, c.staffId) }) : formatTime(c.start),
      proposal: build(c),
    })),
  };
}

function bookProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const customer = findCustomer(state, params.customerId);
  const service = findService(state, params.serviceId ?? "");
  const date = params.date;
  if (!customer || !service || !date) return message(t("command.notUnderstood"));
  if (date < clock.today) return message(t("command.dayPassed", { day: formatDayLong(date) }));
  const preferred = preferredStaffOf(state, customer);
  const remembered = rememberedPreference(state, customer.id);
  const staffIds = params.staffId
    ? service.staffIds.filter((id) => id === params.staffId)
    : [...service.staffIds].sort((a, b) => Number(b === preferred) - Number(a === preferred));
  const build = ({ staffId, start }: Candidate): Proposal => ({
    kind: "change",
    title: t("command.book.title", { name: fullName(customer), service: service.name }),
    subtitle: `${formatDuration(service.duration)} · ${formatMoney(service.price)}`,
    rows: [
      { label: t("command.row.when"), before: t("command.free"), after: whenText(date, start) },
      { label: t("command.row.with"), after: staffName(state, staffId) },
      ...(remembered ? [{ label: t("command.row.remembered"), after: remembered.text }] : []),
    ],
    action: { type: "booking/create", customerId: customer.id, serviceId: service.id, staffId, date, start, source: "assistant" },
    toast: t("newBooking.bookedToast", { name: customer.firstName, when: whenText(date, start) }),
  });
  if (params.time) {
    const start = minutesOf(params.time);
    const upcoming = date > clock.today || start >= clock.minutes;
    const staffId = upcoming ? staffIds.find((id) => isFree(state, id, date, start, needOf(service))) : undefined;
    if (staffId) return build({ staffId, start });
    return chooseSlot(state, pickCandidates(state, staffIds, needOf(service), date, clock, { near: start }), t("command.pickAnother"), date, build);
  }
  return chooseSlot(state, pickCandidates(state, staffIds, needOf(service), date, clock, { period: params.period }), t("command.pickTime"), date, build);
}

function bookingLine(state: DemoState, booking: Booking) {
  const service = findService(state, booking.serviceId);
  return `${whenText(booking.date, booking.start)} · ${service?.name ?? ""}`;
}

function moveProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const booking = state.bookings.find((b) => b.id === params.bookingId && b.status === "booked");
  const customer = findCustomer(state, booking?.customerId);
  const date = params.date;
  if (!booking || !customer || !date || !params.time) return message(t("command.notUnderstood"));
  if (date < clock.today) return message(t("command.dayPassed", { day: formatDayLong(date) }));
  const wanted = minutesOf(params.time);
  const build = ({ start }: Candidate): Proposal => ({
    kind: "change",
    title: t("command.move.title", { name: fullName(customer) }),
    subtitle: `${findService(state, booking.serviceId)?.name} · ${staffName(state, booking.staffId)}`,
    rows: [{ label: t("command.row.when"), before: whenText(booking.date, booking.start), after: whenText(date, start) }],
    action: { type: "booking/move", id: booking.id, date, start },
    toast: t("booking.movedToast", { name: customer.firstName, when: whenText(date, start) }),
  });
  if (date === booking.date && wanted === booking.start) return message(t("command.alreadyThere"));
  const upcoming = date > clock.today || wanted >= clock.minutes;
  if (upcoming && isFree(state, booking.staffId, date, wanted, booking, booking.id)) return build({ staffId: booking.staffId, start: wanted });
  const candidates = pickCandidates(state, [booking.staffId], booking, date, clock, { near: wanted, ignoreId: booking.id });
  return chooseSlot(state, candidates, t("command.pickAnother"), date, build);
}

function cancelProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const booking = state.bookings.find((b) => b.id === params.bookingId && b.status === "booked");
  const customer = findCustomer(state, booking?.customerId);
  if (!booking || !customer) return message(t("command.notUnderstood"));
  const offering = !!params.offerWaitingList && state.modules.waitlist;
  const offered = offering ? waitlistCount(state, booking) : 0;
  return {
    kind: "change",
    title: t("command.cancel.title", { name: fullName(customer) }),
    subtitle: staffName(state, booking.staffId),
    rows: [
      { label: t("command.row.booking"), before: bookingLine(state, booking), after: t("command.cancelled") },
      ...(offering ? [{ label: t("command.row.waitlist"), after: tc("command.waitlistOffer", offered) }] : []),
    ],
    action: {
      type: "booking/cancel",
      id: booking.id,
      reason: t("cancel.reason.other"),
      notice: offering ? waitlistNotice(booking, offered, clock) : undefined,
    },
    toast: offering ? tc("booking.cancelledOfferedToast", offered) : t("booking.cancelledToast"),
    destructive: true,
  };
}

function serviceOf(state: DemoState, id: string | undefined): Service | undefined {
  return findService(state, id ?? "");
}

/** Opens the campaign studio with the offer filled in, so the owner only reviews and writes the texts. */
export function studioProposal(prefill: CampaignPrefill): Proposal {
  const period = prefill.from === prefill.to ? formatDayMonth(prefill.from) : `${formatDayMonth(prefill.from)} – ${formatDayMonth(prefill.to)}`;
  return {
    kind: "message",
    text: t("command.campaign.text", { name: prefill.name, percent: prefill.discountPercent, period }),
    link: { href: studioHref(prefill, true), label: t("command.campaign.open") },
  };
}

function campaignProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const service = serviceOf(state, params.serviceId);
  if (!service || params.percentOff === undefined || !params.start || !params.end) return message(t("command.notUnderstood"));
  const from = params.start > clock.today ? params.start : clock.today;
  const to = params.end > from ? addDays(params.end, -1) : from;
  return studioProposal({
    name: t("campaigns.name.discount", { percent: params.percentOff, service: service.name }),
    serviceIds: [service.id],
    discountPercent: params.percentOff,
    from,
    to,
  });
}

function priceProposal(state: DemoState, params: IntentParams): Proposal {
  const service = serviceOf(state, params.serviceId);
  if (!service || params.priceSek === undefined) return message(t("command.notUnderstood"));
  if (!validServicePrice(params.priceSek)) return message(t("services.issue.price"));
  return {
    kind: "change",
    title: t("command.price.title", { service: service.name }),
    rows: [{ label: t("command.row.price"), before: formatMoney(service.price), after: formatMoney(params.priceSek) }],
    action: { type: "service/price", id: service.id, price: params.priceSek },
    toast: t("command.price.changed", { service: service.name }),
  };
}

/** The product the owner means, or the question which one. `choose` builds the proposal for a picked product. */
function pickProduct(items: StockItem[], text: string | undefined, build: (item: StockItem) => Proposal): Proposal {
  const matches = findProducts(items, text ?? "");
  if (!matches.length) return message(t("command.stock.none", { product: text ?? "" }));
  if (matches.length === 1) return build(matches[0]);
  return { kind: "choose", title: t("command.stock.pick"), choices: matches.slice(0, 6).map((item) => ({ label: item.name, proposal: build(item) })) };
}

function stockProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  return pickProduct(state.stock, params.product, (item) => {
    const quantity = purchaseQuantity(state, item, clock.today);
    const lead = supplierOf(state, item)?.leadDays ?? 0;
    return {
      kind: "change",
      title: t("command.stock.title", { name: item.name }),
      subtitle: item.supplier,
      rows: [
        { label: t("command.row.quantity"), after: t("command.stock.quantity", { count: quantity, unit: item.unit }) },
        { label: t("command.row.onOrder"), before: String(item.onOrder), after: String(item.onOrder + quantity) },
        { label: t("command.row.cost"), after: formatMoney(quantity * item.unitCost) },
        { label: t("command.row.arrives"), after: tc("command.stock.arrives", lead) },
      ],
      action: { type: "stock/order", orders: buildOrders(state, [{ item, quantity }], clock.today), at: { date: clock.today, time: clock.minutes } },
      toast: t("stock.ordered", { suppliers: item.supplier }),
    };
  });
}

function stockLevelProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const matches = findProducts(state.stock, params.product ?? "");
  if (!matches.length) return message(t("command.stock.none", { product: params.product ?? "" }));
  return {
    kind: "stock",
    title: t("command.stock.levelTitle"),
    items: matches.slice(0, MAX_LISTED_PRODUCTS).map((item) => {
      const days = ruleForecast(forecastInput(state, item, clock.today)).daysRemaining;
      return {
        id: item.id,
        name: item.name,
        left: formatAmount(item.inStock),
        unit: item.unit,
        detail: days === null ? undefined : days < 1 ? t("stock.almostOut") : tc("stock.runsOut", days),
        low: item.inStock <= item.reorderAt,
      };
    }),
  };
}

function sellProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const customer = findCustomer(state, params.customerId);
  if (!customer) return message(t("command.notUnderstood"));
  const quantity = params.quantity ?? 1;
  const matches = findProducts(state.stock, params.product ?? "");
  if (matches.length && !matches.some((item) => item.salePrice !== undefined)) return message(t("command.stock.notForSale", { product: matches[0].name }));
  return pickProduct(sellable(state), params.product, (item) => {
    if (item.inStock < quantity) return message(t("command.stock.outOf", { count: formatAmount(item.inStock), product: item.name }));
    return {
      kind: "change",
      title: t("command.stock.sellTitle", { product: item.name, name: fullName(customer) }),
      rows: [
        { label: t("command.row.quantity"), after: String(quantity) },
        { label: t("command.row.price"), after: formatMoney(quantity * (item.salePrice ?? 0)) },
        { label: t("command.row.stock"), before: formatAmount(item.inStock), after: formatAmount(item.inStock - quantity) },
      ],
      action: { type: "product/sell", customerId: customer.id, stockId: item.id, quantity, date: clock.today },
      toast: t("stock.sold", { product: item.name, name: customer.firstName }),
    };
  });
}

function revenueProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  if (!params.start || !params.end) return message(t("command.notUnderstood"));
  const result = revenueBetween(state, clock.today, clock.minutes, params.start, params.end);
  const last = addDays(params.end, -1);
  return {
    kind: "revenue",
    title: t("command.revenue.title"),
    range: last <= params.start ? formatDayLong(params.start) : `${formatDayMonth(params.start)} – ${formatDayMonth(last)}`,
    total: result.total,
    visits: result.visits,
    bars: result.byService.slice(0, 5).map((row) => ({ id: row.id, label: row.id === PRODUCTS_ROW ? t("stock.products") : (findService(state, row.id)?.name ?? row.id), value: row.total })),
  };
}

/** Customers whose last visit was before `since` and who have nothing booked, most loyal first. */
export function lapsedCustomers(state: DemoState, since: DateKey, today: DateKey) {
  const stats = buildCustomerStats(state, today);
  return state.customers
    .flatMap((customer) => {
      const s = stats.get(customer.id);
      return s?.lastVisit && s.lastVisit < since && !s.nextBooking ? [{ customer, visits: s.visits, lastVisit: s.lastVisit }] : [];
    })
    .sort((a, b) => b.visits - a.visits || a.lastVisit.localeCompare(b.lastVisit));
}

function inactiveProposal(state: DemoState, params: IntentParams, clock: Clock): Proposal {
  const since = params.since;
  if (!since) return message(t("command.notUnderstood"));
  const lapsed = lapsedCustomers(state, since, clock.today);
  return {
    kind: "customers",
    title: t("command.customers.title", { date: formatDayMonth(since) }),
    total: lapsed.length,
    items: lapsed.slice(0, MAX_LISTED_CUSTOMERS).map(({ customer, visits, lastVisit }) => ({
      id: customer.id,
      name: fullName(customer),
      detail: `${tc("command.customers.visits", visits)} · ${t("command.customers.last", { ago: agoText(lastVisit, clock.today) })}`,
    })),
  };
}

function moduleOff(module: ModuleManifest): Proposal {
  return message(t("command.moduleOff", { module: t(module.name) }), { href: "/studio/more/features", label: t("command.moduleOff.open") });
}

/** Everything the card needs for one interpreter result. `examples` fill in when the command is too vague. */
export function proposalFor(state: DemoState, intent: IntentResult, text: string, clock: Clock, examples: string[], role: Role = "owner"): Proposal {
  const { params } = intent;
  if (!canCommand(role, intent.action)) return message(t("command.ownerOnly"));
  if ((intent.action === "move" || intent.action === "cancel") && !canChangeBooking(state, role, params.bookingId ?? "")) {
    return message(t("command.notUnderstood"));
  }
  const blocker = blockingModule(state.modules, intent.action);
  if (blocker) return moduleOff(blocker);
  const insight = role === "owner" && ["question", "revenue"].includes(intent.action) ? insightFor(state, text, clock) : null;
  if (insight) return insight.chart.unit === "percent" || state.modules.finance ? insight : moduleOff(moduleById("finance"));
  const requested = role === "owner" && ["question", "campaign", "make-poster"].includes(intent.action) ? parseCampaignRequest(text, state, clock.today) : null;
  if (requested) return state.modules.campaigns ? studioProposal(requested) : moduleOff(moduleById("campaigns"));
  const designed = role === "owner" && intent.action === "question" ? pageProposal(state, text) : null;
  if (designed) return designed;
  switch (intent.action) {
    case "question": {
      const choices = clarifyChoices(intent.question, text, state, clock.today, examples);
      const title = questionText(intent.question);
      return choices.length ? { kind: "choose", title, choices } : message(title);
    }
    case "book":
      return bookProposal(state, params, clock);
    case "move":
      return moveProposal(state, params, clock);
    case "cancel":
      return cancelProposal(state, params, clock);
    case "campaign":
      return campaignProposal(state, params, clock);
    case "change-price":
      return priceProposal(state, params);
    case "order-stock":
      return stockProposal(state, params, clock);
    case "stock-level":
      return stockLevelProposal(state, params, clock);
    case "sell-product":
      return sellProposal(state, params, clock);
    case "make-poster":
      return message(t("command.poster", { occasion: params.occasion ?? "" }), { href: STUDIO_HREF, label: t("command.poster.open") });
    case "revenue":
      return revenueProposal(state, params, clock);
    case "inactive-customers":
      return inactiveProposal(state, params, clock);
    case "staff-off":
      return staffOffProposal(state, params, clock);
    case "close-salon":
      return closeSalonProposal(state, params, clock);
    case "staff-shift":
      return shiftProposal(state, params, clock);
  }
}
