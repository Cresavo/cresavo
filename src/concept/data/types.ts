// Data model for the clickable demo. No database: everything is generated
// deterministically in `generate.ts` and kept in the browser (see `../store.ts`).

/** Local calendar day, "YYYY-MM-DD". */
export type DateKey = string;

export type StaffId = "anna" | "erik";
export type Category = "foot" | "massage";

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
  category: "Foot care" | "Massage" | "Hygiene" | "Retail";
  unit: string;
  inStock: number;
  reorderAt: number;
  /** Approximate use per week. */
  usagePerWeek: number;
  supplier: string;
  unitCost: number;
  /** Ordered but not yet delivered. */
  onOrder: number;
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

export interface Campaign {
  id: string;
  name: string;
  serviceIds: string[];
  discountPercent: number;
  from: DateKey;
  to: DateKey;
  status: CampaignStatus;
  channels: string[];
  holidayId?: string;
  stats?: { reach: number; clicks: number; bookings: number };
}

export type ModuleKey = "journal" | "stock" | "campaigns" | "finance" | "reviews";

export interface DemoState {
  version: number;
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
  reviews: Review[];
  inbox: InboxItem[];
  holidays: Holiday[];
  campaigns: Campaign[];
  modules: Record<ModuleKey, boolean>;
  /** Suggestion cards on Today that the owner dismissed. */
  dismissedCards: string[];
}
