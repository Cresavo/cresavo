import type { BookingProtection, CancellationPolicy, CheckoutHold } from "../booking/protection";
import type { Industry } from "../onboarding/salon";
import type { BusinessLocalization } from "../i18n/business";
import type { ReminderSettings } from "../booking/reminders";
// Data model for the clickable demo. No database: everything is generated
// deterministically in `generate.ts` and kept in the browser (see `../store.ts`).

import type { MemoryItem } from "../assistant/memory";
import type { Routine } from "../assistant/routines";
import type { AccountingLink, Cost, MonthFigures } from "../finance/types";
import type { LogEntry } from "../log/types";
import type { PageConfig } from "../page/config";
import type { DomainConnection } from "../page/domain";
import type { SupportGrant } from "../support/access";
import type { Ticket } from "../support/tickets";
import type { TrashEntry } from "../trash/trash";

/** Local calendar day, "YYYY-MM-DD". */
export type DateKey = string;

export type StaffId = "anna" | "erik" | `staff-${number}`;
/** Industry pack the demo business belongs to. */
export type PackId = "foot-massage" | "hair" | "nails" | "trainer" | "clinic";
/** The category ids the industry packs start from; every pack has two. An owner can add their own (see `ServiceCategory`). */
export type Category = "foot" | "massage" | "cut" | "colour" | "manicure" | "pedicure" | "personal" | "group" | "physio" | "recovery";

/** A heading on the price list. The list order in the state is the order customers see. */
export interface ServiceCategory {
  id: string;
  name: string;
}

/** A span of the day, minutes from midnight. */
export interface Interval {
  start: number;
  end: number;
}

/** A day the salon is closed on top of the weekly hours (holiday, training day). */
export interface Closure {
  id: string;
  date: DateKey;
  name: string;
}

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
  /** The lunch break on long days; null = no break. */
  lunch: Interval | null;
  closures: Closure[];
}

export interface Staff {
  id: StaffId;
  photo?: string;
  firstName: string;
  lastName: string;
  role: string;
  title: string;
  /** Weekly template: working hours per weekday (0 = Sunday), null = day off. */
  week: Record<number, Interval | null>;
  bio: string;
  phone: string;
}

export interface Service {
  id: string;
  name: string;
  /** Id of a `ServiceCategory`. */
  category: string;
  staffIds: StaffId[];
  duration: number;
  price: number;
  description: string;
  /** Recommended weeks between visits, used for recall reminders. */
  recallWeeks: number;
  image?: string;
  /** Products used up by one visit; lowers the stock when the visit is marked done. */
  consumption?: StockUse[];
  /** Rooms or chairs the treatment can use (any one of them). Empty = needs no resource. */
  resourceIds?: string[];
  /** Kept in the studio but not offered on the booking page or to customers' assistants. */
  hidden?: boolean;
}

export type ResourceKind = "room" | "chair" | "equipment";

/** Something a booking occupies besides the person: only one booking can use it at a time. */
export interface Resource {
  id: string;
  name: string;
  kind: ResourceKind;
}

export interface StaffBlock extends Interval {
  id: string;
  staffId: StaffId;
  date: DateKey;
  reason: "break" | "training" | "admin";
}

export type TimeOffReason = "vacation" | "sick" | "other";

/** One day that differs from a person's weekly template: time off, or a shift of their own hours. */
export type StaffException = { id: string; staffId: StaffId; date: DateKey } & (
  | { kind: "off"; reason: TimeOffReason }
  | { kind: "shift"; start: number; end: number }
);

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
  /** The category the customer usually books (a `ServiceCategory` id), or "both". */
  category: string;
  preferredStaff: StaffId;
  since: DateKey;
  /** Date of birth, used for the "birthday this month" segment. */
  birthday?: DateKey;
  isRegular: boolean;
  note?: string;
  tags: string[];
  /** Wants offers when a slot frees up (waiting list). */
  waitlist: boolean;
  /** A fictional sample a new salon starts with, so its day is not empty. */
  example?: true;
}

export type BookingStatus = "booked" | "completed" | "cancelled" | "noshow";
export type BookingSource = "online" | "phone" | "walk-in" | "campaign" | "assistant";

export interface Booking {
  protection?: BookingProtection;
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
  /** The room or chair the visit uses, picked when it is booked. */
  resourceId?: string;
  note?: string;
  cancelReason?: string;
  /** A fictional sample a new salon starts with; never counts as the salon's own first booking. */
  example?: true;
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
  /** Legacy fictional reviews are already public; new customer reviews start false. */
  approved?: boolean;
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
  /** Simulated booking delivery; never an outgoing network request. */
  delivery?: { channel: "sms" | "email"; kind: "confirmation" | "reminder"; slot: string };
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
  /** Practitioner requested by a customer joining the waiting list. */
  requestedStaffId?: StaffId;
  reviewId?: string;
  /** Slot the reply can offer. */
  suggestion?: SlotSuggestion;
  /** Set on the note for a simulated text that offered a freed slot or today's gaps to the waiting list. */
  waitlistOffer?: boolean;
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
/** The first five are drawn in the browser; the rest are rendered by the server poster engine. */
export type PosterStyle = "calm" | "bold" | "photo" | "arch" | "dusk" | "price" | "pricelist" | "season" | "review" | "slots" | "beforeafter";
export type PosterFormat = "post" | "story" | "window";

export interface CampaignPoster {
  style: PosterStyle;
  /** Photo in /public/demo. */
  image: string;
  headline: string;
  detail: string;
  /** The owner's adjustments; unset means the template's own choice. */
  textSize?: PosterTextSize;
  focus?: PosterFocus;
  /** Engine styles: the price shown large, a small sticker and the treatments with prices, from the price list. */
  price?: string;
  sticker?: [string, string];
  items?: { name: string; price: string }[];
  /** Engine styles: a call to book, and a customer's words with who said them (published reviews only). */
  cta?: string;
  quote?: string;
  author?: string;
  /** Engine styles: the wellness-benefit services the salon accepts, e.g. "Epassi". */
  badges?: string[];
  /** Before/after style: the "before" photo; `image` is the "after" photo. */
  before?: string;
  /** Engine styles: the owner's light, contrast and warmth adjustment of the photos, in percent. The photo itself is untouched. */
  photoTone?: PosterTone;
}
export interface PosterTone {
  light: number;
  contrast: number;
  warmth: number;
}
export type PosterTextSize = "small" | "normal" | "large";
/** Which part of the photo stays in view when the template crops it. */
export type PosterFocus = "top" | "center" | "bottom";

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

/** A gift card the business sold. What it still holds is derived from `redemptions` (see `../giftcards/cards.ts`). */
export interface GiftCard {
  id: string;
  /** What the customer types to use or check it, e.g. "EKO-7K2Q-93XD". */
  code: string;
  /** Face value in SEK, paid when it was sold. */
  amount: number;
  recipient: string;
  message: string;
  soldOn: DateKey;
  /** Booking payments made with the card. A cancelled booking gives its amount back. */
  redemptions: { bookingId: string; amount: number; date: DateKey; returned?: boolean }[];
}

/** A punch card: visits of one treatment paid in advance. */
export interface ServicePackage {
  id: string;
  customerId: string;
  serviceId: string;
  /** Visits the package holds in total. */
  visits: number;
  /** What the customer paid in SEK. */
  price: number;
  soldOn: DateKey;
  /** Bookings marked done that used a visit. */
  usedBy: string[];
}

export type ModuleKey = "journal" | "stock" | "campaigns" | "finance" | "reviews" | "waitlist" | "assistant" | "giftcards" | "packages" | "domain";

export interface DemoState {
  cancellationPolicy: CancellationPolicy;
  checkoutHolds: CheckoutHold[];
  /** Null for generated example businesses. */
  industry: Industry | null;
  version: number;
  pack: PackId;
  /** Date of the snapshot. Only sample businesses regenerate on a new day. */
  generatedFor: DateKey;
  seq: number;
  salon: Salon;
  localization: BusinessLocalization;
  reminderSettings: ReminderSettings;
  staff: Staff[];
  /** The price list, in the order it is shown. */
  services: Service[];
  /** Deleted treatments that bookings, punch cards or campaigns still refer to; never offered again. */
  retiredServices: Service[];
  /** Price list headings, in the order they are shown. */
  categories: ServiceCategory[];
  resources: Resource[];
  /** Days off and extra shifts on top of the staff members' weekly templates. */
  exceptions: StaffException[];
  blocks?: StaffBlock[];
  customers: Customer[];
  bookings: Booking[];
  journals: JournalEntry[];
  stock: StockItem[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  sales: ProductSale[];
  giftCards: GiftCard[];
  packages: ServicePackage[];
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
  /** What happened, newest first. */
  log: LogEntry[];
  /** Cancelled bookings and deleted customers that can still be restored. */
  trash: TrashEntry[];
  /** Times the owner let support look at the account. */
  supportGrants: SupportGrant[];
  /** Help requests created from the Help button. */
  tickets: Ticket[];
  /** What the assistant remembers about the business: facts, preferences, past conversations. */
  memory: MemoryItem[];
  /** Routines (skills) the owner keeps; each runs on its schedule and only proposes. */
  routines: Routine[];
  /** How the public booking page looks: theme, sections and the owner's own CSS. */
  page: PageConfig;
  /** The business's own domain (a paid module), once the owner has started connecting one. */
  domain: DomainConnection | null;
}
