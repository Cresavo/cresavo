export interface ApiResource {
  resource: string;
  read: "available" | "planned";
  write: "available" | "propose" | "planned";
  mcp: "available" | "planned";
  events: "available" | "planned";
}

/** Read describes REST. Write records proposal support first, then direct REST coverage. */
export const CORE_API: readonly ApiResource[] = [
  { resource: "bookings", read: "available", write: "propose", mcp: "available", events: "planned" },
  { resource: "customers", read: "available", write: "available", mcp: "available", events: "planned" },
  { resource: "services", read: "available", write: "propose", mcp: "available", events: "planned" },
  { resource: "staff", read: "available", write: "available", mcp: "available", events: "planned" },
  { resource: "hours", read: "planned", write: "planned", mcp: "available", events: "planned" },
  { resource: "booking-page-profile", read: "planned", write: "planned", mcp: "available", events: "planned" },
  { resource: "inbox", read: "available", write: "propose", mcp: "available", events: "planned" },
];
