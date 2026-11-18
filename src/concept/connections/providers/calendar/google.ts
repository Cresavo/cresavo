// Google Calendar API v3 over plain fetch.
// Sources (checked 2026-11):
// - Insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
// - Event resource and id rules: https://developers.google.com/workspace/calendar/api/v3/reference/events
// - Client-supplied ids and 409 duplicate: https://developers.google.com/workspace/calendar/api/guides/create-events
// - List and sync tokens (410 Gone): https://developers.google.com/workspace/calendar/api/v3/reference/events/list, https://developers.google.com/workspace/calendar/api/guides/sync
// - Errors and quotas (403/429 rateLimitExceeded): https://developers.google.com/workspace/calendar/api/guides/errors, https://developers.google.com/workspace/calendar/api/guides/quota
// - OAuth token endpoint: https://developers.google.com/identity/protocols/oauth2/web-server#offline
// Scope: https://www.googleapis.com/auth/calendar.events
import { connectionError, fail, isTimeZone, isUtc, ok } from "../../core";
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
      if (!calendarId || !event.id || !isUtc(event.start) || !isUtc(event.end) || event.end <= event.start || !isTimeZone(event.timeZone) || !event.title.trim()) {
        return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      }
      const id = googleEventId(event.id);
      const result = await authed(calendarPath(calendarId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          summary: event.title,
          ...(event.description ? { description: event.description } : {}),
          ...(event.location ? { location: event.location } : {}),
          start: { dateTime: event.start, timeZone: event.timeZone },
          end: { dateTime: event.end, timeZone: event.timeZone },
          extendedProperties: { private: { cresavoId: event.id } },
        }),
      });
      // A retry of the same booking hits the same id: the event already exists.
      if (!result.ok && result.error.code === "conflict") return ok({ providerEventId: id }, "delivered", null, id);
      if (!result.ok) return fail(result.error);
      return ok({ providerEventId: text(field(result.data, "id")) ?? id }, "delivered", null, id);
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
      let pageToken: string | undefined;
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
        for (const item of Array.isArray(items) ? items : []) {
          const providerEventId = text(field(item, "id"));
          if (!providerEventId || field(item, "transparency") === "transparent") continue;
          const cancelled = field(item, "status") === "cancelled";
          const start = utc(field(item, "start", "dateTime")) ?? utc(field(item, "start", "date"));
          const end = utc(field(item, "end", "dateTime")) ?? utc(field(item, "end", "date"));
          if (!cancelled && (!start || !end)) continue;
          const ownId = text(field(item, "extendedProperties", "private", "cresavoId"));
          events.push({ providerEventId, start: start ?? "", end: end ?? "", cancelled, ...(ownId ? { ownId } : {}) });
        }
        pageToken = text(field(result.data, "nextPageToken"));
        const nextSyncToken = text(field(result.data, "nextSyncToken"));
        if (!pageToken) return ok({ events, ...(nextSyncToken ? { nextSyncToken } : {}), fullResyncRequired: false }, "delivered");
      }
      // Too many pages for one call: keep what we have and ask for a fresh window rather than loop forever.
      return ok({ events, fullResyncRequired: true }, "delivered");
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
