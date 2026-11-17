// Data model for the clickable demo. No database: everything is generated
// deterministically in `generate.ts` and kept in the browser (see `../store.ts`).

import type { AccountingLink, Cost, MonthFigures } from "../finance/types";

/** Local calendar day, "YYYY-MM-DD". */
export type DateKey = string;

export type StaffId = "anna" | "erik";
/** Industry pack the demo business belongs to. */
export type PackId = "foot-massage" | "hair" | "nails" | "trainer" | "clinic";
/** A group of services on the price list; every pack has two. */
export type Category = "foot" | "massage" | "cut" | "colour" | "manicure" | "pedicure" | "personal" | "group" | "physio" | "recovery";

export interface Salon {
  name: string;
  slug: string;
  tagline: string;
  address: string;
  area: string;
  phone: string;
  email: string;
  orgNumber: string;
  /** Opening hours per weekday (0 = Sunday), minutes from midnight. null = closed. */
  hours: Record<number, { open: number; close: number } | null>;
  lunch: { start: number; end: number };
}

export interface Staff {
  id: StaffId;
  firstName: string;
  lastName: string;
  role: string;
  title: string;
  /** Weekdays the person works (0 = Sunday). */
  workdays: number[];
  bio: string;
  phone: string;
}

export interface Service {
  id: string;
  name: string;
  category: Category;
  staffIds: StaffId[];
  duration: number;
  price: number;
  description: string;
  /** Recommended weeks between visits, used for recall reminders. */
  recallWeeks: number;
  image?: string;
  /** Products used up by one visit; lowers the stock when the visit is marked done. */
  consumption?: StockUse[];
}

/** An amount of a stock item, in the item's own unit (0.2 = a fifth of a tube). */
export interface StockUse {
  stockId: string;
  quantity: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  category: Category | "both";
  preferredStaff: StaffId;
  since: DateKey;
  /** Date of birth, used for the "birthday this month" segment. */
  birthday?: DateKey;
  isRegular: boolean;
  note?: string;
  tags: string[];
  /** Wants offers when a slot frees up (waiting list). */
  waitlist: boolean;
}

export type BookingStatus = "booked" | "completed" | "cancelled" | "noshow";
export type BookingSource = "online" | "phone" | "walk-in" | "campaign" | "assistant";

export interface Booking {
  id: string;
  customerId: string;
  staffId: StaffId;
  serviceId: string;
  date: DateKey;
  /** Minutes from midnight. */
  start: number;
  duration: number;
  price: number;
  status: BookingStatus;
  source: BookingSource;
  note?: string;
  cancelReason?: string;
}

/** Demo photo shown in a journal entry. */
export interface JournalPhotos {
  before?: string;
  after?: string;
}

/** What a journal entry says; every edit keeps the previous content as a version. */
export interface JournalContent {
  treatment: string;
  observations: string;
  advice: string;
  nextVisit?: string;
  photos?: JournalPhotos;
}

export interface JournalVersion extends JournalContent {
  /** Day this content was replaced by an edit. */
  replacedOn: DateKey;
}

export interface JournalEntry extends JournalContent {
  id: string;
  customerId: string;
  bookingId?: string;
  date: DateKey;
  staffId: StaffId;
  /** Earlier versions, oldest first. */
  versions?: JournalVersion[];
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  inStock: number;
  reorderAt: number;
  /** Approximate use per week. */
  usagePerWeek: number;
  supplier: string;
  unitCost: number;
  /** Ordered but not yet delivered. */
  onOrder: number;
  /** Price to a customer when the product is sold over the counter. */
  salePrice?: number;
}

export interface Supplier {
  name: string;
  email: string;
  /** Days from order to delivery. */
  leadDays: number;
}

export interface OrderLine {
  stockId: string;
  quantity: number;
  unitCost: number;
  /** What actually arrived; set when the goods are received. */
  received?: number;
}

/** A purchase approved by the owner and sent (simulated) to a supplier. */
export interface PurchaseOrder {
  id: string;
  supplier: string;
  date: DateKey;
  lines: OrderLine[];
  status: "open" | "received";
  receivedOn?: DateKey;
}

/** A product sold to a customer over the counter. */
export interface ProductSale {
  id: string;
  customerId: string;
  stockId: string;
  quantity: number;
  /** Total paid. */
  amount: number;
  date: DateKey;
}

export interface Review {
  id: string;
  customerId: string;
  bookingId?: string;
  staffId: StaffId;
  date: DateKey;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  source: "Google" | "Booking page";
  reply?: string;
}

export type InboxKind = "request" | "reschedule" | "cancel" | "review" | "message" | "system";

export interface SlotSuggestion {
  staffId: StaffId;
  serviceId: string;
  date: DateKey;
  start: number;
}

export interface InboxItem {
  id: string;
  kind: InboxKind;
  customerId?: string;
  /** Sender name when it is a new customer not yet in the register. */
  fromName?: string;
  date: DateKey;
  time: number;
  title: string;
  body: string;
  read: boolean;
  handled: boolean;
  bookingId?: string;
  reviewId?: string;
  /** Slot the reply can offer. */
  suggestion?: SlotSuggestion;
  /** Set on a simulated time suggestion sent from the due-back list. */
  recallServiceId?: string;
  /** Prefilled reply. */
  draftReply?: string;
  /** Sent reply (simulated). */
  reply?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: DateKey;
  idea: string;
  serviceIds: string[];
  /** How many days ahead a campaign should start. */
  leadDays: number;
}

export type CampaignStatus = "active" | "planned" | "ended" | "draft";
export type Channel = "instagram" | "facebook" | "tiktok" | "newsletter" | "sms";
export type PosterStyle = "calm" | "bold" | "photo" | "arch" | "dusk";
export type PosterFormat = "post" | "story" | "window";

export interface CampaignPoster {
  style: PosterStyle;
  /** Photo in /public/demo. */
  image: string;
  headline: string;
  detail: string;
}

/** Simulated results: the demo never talks to a real channel. */
export interface CampaignStats {
  reach: number;
  clicks: number;
  bookings: number;
  revenue: number;
}

export interface CampaignAd {
  budget: number;
  days: number;
  radiusKm: number;
}

export interface Campaign {
  id: string;
  name: string;
  serviceIds: string[];
  discountPercent: number;
  from: DateKey;
  to: DateKey;
  status: CampaignStatus;
  channels: Channel[];
  holidayId?: string;
  /** Day the posts go (or went) out. */
  publishOn?: DateKey;
  /** Final text per channel, including the trackable link. */
  copy?: Partial<Record<Channel, string>>;
  poster?: CampaignPoster;
  /** Trackable link, e.g. "salongeko.example/c/fathers-day-7k2". */
  link?: string;
  ad?: CampaignAd;
  stats?: CampaignStats;
}

export type ModuleKey = "journal" | "stock" | "campaigns" | "finance" | "reviews" | "waitlist" | "assistant";

export interface DemoState {
  version: number;
  pack: PackId;
  /** Day the data was generated for. A new day regenerates the data. */
  generatedFor: DateKey;
  seq: number;
  salon: Salon;
  staff: Staff[];
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  journals: JournalEntry[];
  stock: StockItem[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  sales: ProductSale[];
  reviews: Review[];
  inbox: InboxItem[];
  holidays: Holiday[];
  campaigns: Campaign[];
  /** Monthly totals from before the bookings start. */
  monthHistory: MonthFigures[];
  /** Costs paid every month. */
  costs: Cost[];
  accounting: AccountingLink;
  modules: Record<ModuleKey, boolean>;
  /** Suggestion cards on Today that the owner dismissed. */
  dismissedCards: string[];
}
