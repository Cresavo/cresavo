export interface IntentContext {
  customers: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number; priceSek: number }[];
  staff: { id: string; name: string }[];
  bookings: { id: string; customerId: string; staffId: string; serviceId: string; start: string }[];
  /** ISO instant; all relative dates use the salon timezone, never the host timezone. */
  now: string;
  timezone?: string;
}

export type IntentAction = "book" | "move" | "cancel" | "campaign" | "revenue" | "inactive-customers" | "order-stock" | "make-poster" | "change-price";
export interface IntentParams {
  customerId?: string;
  serviceId?: string;
  staffId?: string;
  bookingId?: string;
  date?: string;
  time?: string;
  period?: "morning" | "afternoon";
  start?: string;
  end?: string;
  since?: string;
  percentOff?: number;
  priceSek?: number;
  offerWaitingList?: boolean;
  product?: string;
  occasion?: string;
}
export type IntentResult = {
  action: IntentAction;
  params: IntentParams;
  summary: string;
  confidence: number;
} | {
  action: "question";
  params: IntentParams;
  summary: string;
  confidence: number;
  question: string;
};
