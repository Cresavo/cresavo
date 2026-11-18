// Google Calendar API v3 over plain fetch.
// Sources (checked 2026-11):
// - Insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
// - Event resource and id rules: https://developers.google.com/workspace/calendar/api/v3/reference/events
// - Update (PUT, used when the id already exists): https://developers.google.com/workspace/calendar/api/v3/reference/events/update
// - Client-supplied ids and 409 duplicate: https://developers.google.com/workspace/calendar/api/guides/create-events
// - List and sync tokens (410 Gone): https://developers.google.com/workspace/calendar/api/v3/reference/events/list, https://developers.google.com/workspace/calendar/api/guides/sync
// - Errors and quotas (403/429 rateLimitExceeded): https://developers.google.com/workspace/calendar/api/guides/errors, https://developers.google.com/workspace/calendar/api/guides/quota
// - OAuth token endpoint: https://developers.google.com/identity/protocols/oauth2/web-server#offline
// Scope: https://www.googleapis.com/auth/calendar.events
import { DateTime } from "luxon";
import { connectionError, fail, isBefore, isTimeZone, isUtc, ok } from "../../core";
import type { BusyEvent, CalendarPort } from "../../ports/calendar";
import { field, request, text, type Fetcher } from "../../server/http";
import { accessToken, type OAuthClient } from "../../server/oauth";
import type { ProviderDefinition } from "../definition";
import { googleEventId } from "./ids";

const PROVIDER = "google-calendar";
const BASE = "https://www.googleapis.com/calendar/v3/calendars";
const MAX_PAGES = 10;

const codeOf = (data: unknown, status: number) => {
  const reason = field(data, "error", "errors", 0, "reason");
  if (status === 403 && (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")) return { code: "rate_limited" as const, providerCode: reason };
  return { providerCode: reason ?? field(data, "error", "status") };
};

const utc = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
};

/** An all-day boundary ("2026-11-18") is local midnight in the calendar's zone; Google's end date is exclusive. */
const dayStart = (date: unknown, zone: string) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const local = DateTime.fromISO(date, { zone });
  return local.isValid ? local.toUTC().toISO({ suppressMilliseconds: true })! : undefined;
};

export function googleCalendar(options: { oauth: OAuthClient; fetch: Fetcher }): CalendarPort {
  const context = { port: "calendar" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.oauth.clientSecret, options.oauth.refreshToken] };
  const authed = async (url: string, init: RequestInit) => {
    const token = await accessToken(options.oauth, "calendar", PROVIDER, options.fetch);
    if (!token.ok) return token;
    return request(context, url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.token}` } }, codeOf);
  };
  const calendarPath = (calendarId: string) => `${BASE}/${encodeURIComponent(calendarId)}/events`;

  return {
    info: definition.info,
    async pushEvent(calendarId, event) {
      if (!calendarId || !event.id || !isUtc(event.start) || !isUtc(event.end) || !isBefore(event.start, event.end) || !isTimeZone(event.timeZone) || !event.title.trim()) {
        return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      }
      const id = googleEventId(event.id);
      const fields = {
        summary: event.title,
        description: event.description ?? "",
        location: event.location ?? "",
        start: { dateTime: event.start, timeZone: event.timeZone },
        end: { dateTime: event.end, timeZone: event.timeZone },
        extendedProperties: { private: { cresavoId: event.id } },
        status: "confirmed",
      };
      const result = await authed(calendarPath(calendarId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...fields }) });
      if (result.ok) return ok({ providerEventId: text(field(result.data, "id")) ?? id }, "delivered", null, id);
      if (result.error.code !== "conflict") return fail(result.error);
      // The booking's event already exists (a retry or a moved booking): bring it up to date.
      const updated = await authed(`${calendarPath(calendarId)}/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      return updated.ok ? ok({ providerEventId: id }, "delivered", null, id) : fail(updated.error);
    },
    async deleteEvent(calendarId, providerEventId) {
      if (!/^[0-9a-v_]{5,1024}$/.test(providerEventId)) return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      const result = await authed(`${calendarPath(calendarId)}/${providerEventId}`, { method: "DELETE" });
      if (!result.ok && result.error.code !== "not_found") return fail(result.error);
      return ok({ deleted: true }, "delivered");
    },
    async pullEvents(input) {
      if (!input.syncToken && (!input.from || !input.to || !isUtc(input.from) || !isUtc(input.to))) return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      const events: BusyEvent[] = [];
      let pageToken = input.pageToken;
      for (let page = 0; page < MAX_PAGES; page++) {
        const query = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
        if (input.syncToken) query.set("syncToken", input.syncToken);
        else {
          query.set("timeMin", input.from!);
          query.set("timeMax", input.to!);
        }
        if (pageToken) query.set("pageToken", pageToken);
        const result = await authed(`${calendarPath(input.calendarId)}?${query}`, { method: "GET" });
        if (!result.ok && result.error.httpStatus === 410) return ok({ events: [], fullResyncRequired: true }, "delivered");
        if (!result.ok) return fail(result.error);
        const items = field(result.data, "items");
        if (!Array.isArray(items)) return fail(connectionError("calendar", PROVIDER, "unknown"));
        const zone = text(field(result.data, "timeZone")) ?? "UTC";
        for (const item of items) {
          const providerEventId = text(field(item, "id"));
          if (!providerEventId) continue;
          // A cancelled or "free" (transparent) event no longer blocks time; report it so a stale block is removed.
          const cancelled = field(item, "status") === "cancelled" || field(item, "transparency") === "transparent";
          const start = utc(field(item, "start", "dateTime")) ?? dayStart(field(item, "start", "date"), zone);
          const end = utc(field(item, "end", "dateTime")) ?? dayStart(field(item, "end", "date"), zone);
          if (!cancelled && (!start || !end)) continue;
          const ownId = text(field(item, "extendedProperties", "private", "cresavoId"));
          events.push({ providerEventId, start: start ?? "", end: end ?? "", cancelled, ...(ownId ? { ownId } : {}) });
        }
        pageToken = text(field(result.data, "nextPageToken"));
        const nextSyncToken = text(field(result.data, "nextSyncToken"));
        if (!pageToken) return ok({ events, ...(nextSyncToken ? { nextSyncToken } : {}), fullResyncRequired: false }, "delivered");
      }
      // More pages than one call reads: hand back where to continue.
      return ok({ events, nextPageToken: pageToken, fullResyncRequired: false }, "delivered");
    },
  };
}

export const definition: ProviderDefinition<"calendar"> = {
  info: { port: "calendar", provider: PROVIDER, kind: "live", capabilities: ["push", "pull", "incremental-sync", "idempotency"], secrets: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_CALENDAR_REFRESH_TOKEN"] },
  secrets: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_CALENDAR_REFRESH_TOKEN"],
  settings: [],
  create: ({ secrets, fetch }) =>
    googleCalendar({
      oauth: { tokenUrl: "https://oauth2.googleapis.com/token", clientId: secrets.GOOGLE_OAUTH_CLIENT_ID, clientSecret: secrets.GOOGLE_OAUTH_CLIENT_SECRET, refreshToken: secrets.GOOGLE_CALENDAR_REFRESH_TOKEN, clientAuth: "body" },
      fetch,
    }),
};
