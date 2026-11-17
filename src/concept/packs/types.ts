import type { Campaign, Category, ModuleKey, PackId, Salon, Service, Staff, StockItem, Supplier } from "../data/types";

/** Journal templates, as in `journal.template.<id>.*` in the dictionary. */
export type JournalTemplateId =
  | "foot" | "ingrown" | "massage" | "deep"
  | "hair-cut" | "hair-colour"
  | "nails-mani" | "nails-pedi"
  | "trainer-session" | "trainer-intake"
  | "clinic-assessment" | "clinic-followup" | "clinic-recovery";

/** The words the interface uses for the two things every business names differently. Lower case, singular. */
export interface Vocabulary {
  customer: string;
  service: string;
}

export interface JournalText {
  treatment: string;
  observations: string;
  advice: string;
}

/** Review texts by star rating. */
export type ReviewTexts = Record<number, string[]>;

/** A campaign that already ran or runs now; days are relative to today. */
export type SeedCampaign = Pick<Campaign, "id" | "name" | "serviceIds" | "discountPercent" | "status" | "channels" | "link"> & {
  startsInDays: number;
  endsInDays: number;
  stats: NonNullable<Campaign["stats"]>;
};

/**
 * Everything that makes one industry different in the demo: words, the price
 * list, supplies, journal templates and the seeds the data generator draws on.
 * The team is always Anna (owner) and Erik (employee); the pack gives them
 * their titles. The first category belongs to Anna, the second to Erik.
 */
export interface Pack {
  id: PackId;
  vocabulary: Vocabulary;
  categories: [Category, Category];
  salon: Salon;
  staff: [Staff, Staff];
  services: Service[];
  stock: StockItem[];
  suppliers: Supplier[];
  /** Modules switched on by default. */
  modules: ModuleKey[];
  journalTemplates: { id: JournalTemplateId; category: Category }[];
  /** Demo popularity per service id, in category order. */
  popular: [Record<string, number>, Record<string, number>];
  customerNotes: [string[], string[]];
  /** Note text that earns a customer a tag. */
  tagRules: { find: string; tag: string }[];
  /** Journal entries to draw from per category, and fixed ones for single services. */
  journal: [JournalText[], JournalText[]];
  journalFor: Record<string, JournalText>;
  reviews: [ReviewTexts, ReviewTexts];
  /** Reviews that arrive today: one happy, one with a small complaint. */
  freshReviews: { happy: string; meh: string };
  /** Four service ids used for holiday campaign ideas. */
  featured: [string, string, string, string];
  /** What a returning customer asks for, and a new customer's first message. */
  requests: { returning: { serviceId: string; body: string }; newClient: { name: string; body: string; reply: string; serviceId: string } };
  giftIdea: string;
  campaigns: [SeedCampaign, SeedCampaign];
  /** What a photographed delivery note "reads" when nothing is on order. */
  looseNote: { supplier: string; deliveries: { stockId: string; quantity: number }[] };
}
