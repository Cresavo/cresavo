import type { Adapter, PortResult, TimeZone, UtcTimestamp } from "../core";

export type CalendarCapability = "push" | "pull" | "incremental-sync" | "idempotency";

export interface CalendarEvent {
  /** Our stable id for the booking; adapters derive the provider's idempotent id from it. */
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: UtcTimestamp;
  end: UtcTimestamp;
  /** Zone the event is shown in. */
  timeZone: TimeZone;
}

export interface PushedEvent {
  providerEventId: string;
}

export interface BusyEvent {
  providerEventId: string;
  start: UtcTimestamp;
  end: UtcTimestamp;
  cancelled: boolean;
  /** Our id when the event was pushed by us (so pulls do not double-block). */
  ownId?: string;
}

export interface PullInput {
  calendarId: string;
  /** Opaque cursor from the previous pull. */
  syncToken?: string;
  /** First pull: window start and end. */
  from?: UtcTimestamp;
  to?: UtcTimestamp;
}

export interface PullResult {
  events: BusyEvent[];
  nextSyncToken?: string;
  /** The provider expired the cursor; pull again without it. */
  fullResyncRequired: boolean;
}

export interface CalendarPort extends Adapter<CalendarCapability> {
  pushEvent(calendarId: string, event: CalendarEvent): Promise<PortResult<PushedEvent>>;
  deleteEvent(calendarId: string, providerEventId: string): Promise<PortResult<{ deleted: true }>>;
  pullEvents(input: PullInput): Promise<PortResult<PullResult>>;
}
