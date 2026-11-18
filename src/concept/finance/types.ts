import type { DateKey } from "../data/types";

/** Totals for a stretch of days or months, as shown on the Finance page. */
export interface Figures {
  revenue: number;
  visits: number;
  cancelled: number;
  noShows: number;
  newCustomers: number;
  /** Customers with a finished visit who were already customers before the period. */
  returning: number;
}

/** Monthly totals from before the bookings in the demo start. Lets "last year" be compared. */
export interface MonthFigures extends Figures {
  /** "YYYY-MM" */
  month: string;
}

export type CostKind = "rent" | "products" | "wages" | "fees" | "other";

/** A cost the owner pays every month. */
export interface Cost {
  id: string;
  kind: CostKind;
  label: string;
  /** SEK per month. */
  amount: number;
}

export interface AccountingLink {
  connected: boolean;
  connectedOn?: DateKey;
}

/** "Now" in the salon: the day and minutes from midnight. */
export interface Clock {
  today: DateKey;
  minutes: number;
}
