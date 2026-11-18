// Microsoft Graph v1.0 calendar events over plain fetch.
// Sources (checked 2026-11):
// - Create event: https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0
// - Event resource (transactionId): https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
// - dateTimeTimeZone: https://learn.microsoft.com/en-us/graph/api/resources/datetimetimezone?view=graph-rest-1.0
// - Delta (calendarView/delta, deltaLink, 410 reset): https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0,
//   https://learn.microsoft.com/en-us/graph/delta-query-overview#synchronization-reset
// - Errors: https://learn.microsoft.com/en-us/graph/errors, throttling (Retry-After): https://learn.microsoft.com/en-us/graph/throttling
// - Outlook limits (10,000 requests / 10 min, 4 concurrent per app and mailbox): https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits
// - Token endpoint: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow#refresh-the-access-token
// Permission: Calendars.ReadWrite (delegated, offline_access for a refresh token).
// Times are sent as UTC wall time with timeZone "UTC" (always accepted); the display zone is the mailbox's own.
// verify: v1.0 delta only covers the primary calendar (/users/{id}/calendarView/delta); other calendars need beta.
import { connectionError, fail, isTimeZone, isUtc, ok } from "../../core";
import type { BusyEvent, CalendarPort } from "../../ports/calendar";
import { field, request, text, type Fetcher } from "../../server/http";
import { accessToken, type OAuthClient } from "../../server/oauth";
import type { ProviderDefinition } from "../definition";
import { graphTransactionId } from "./ids";

const PROVIDER = "microsoft-graph";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_PAGES = 10;
const SAFE_SEGMENT = /^[A-Za-z0-9@._=-]{1,256}$/;

const codeOf = (data: unknown) => ({ providerCode: field(data, "error", "code") });
const wall = (utc: string) => utc.replace(/Z$/, "").replace(/(\.\d+)?$/, "");
const toUtc = (value: unknown) => (typeof value === "string" && value ? `${value.replace(/\.\d+$/, "").replace(/Z$/, "")}Z` : undefined);

export function microsoftCalendar(options: { oauth: OAuthClient; user: string; fetch: Fetcher }): CalendarPort {
  const context = { port: "calendar" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.oauth.clientSecret, options.oauth.refreshToken] };
  const authed = async (url: string, init: RequestInit) => {
    const token = await accessToken(options.oauth, "calendar", PROVIDER, options.fetch);
    if (!token.ok) return token;
    return request(context, url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.token}`, Prefer: 'outlook.timezone="UTC"' } }, codeOf);
  };
  const user = encodeURIComponent(options.user);
  const configured = () => SAFE_SEGMENT.test(options.user);

  return {
    info: definition.info,
    async pushEvent(calendarId, event) {
      if (!configured()) return fail(connectionError("calendar", PROVIDER, "not_configured"));
      if (!SAFE_SEGMENT.test(calendarId) || !event.id || !isUtc(event.start) || !isUtc(event.end) || event.end <= event.start || !isTimeZone(event.timeZone) || !event.title.trim()) {
        return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      }
      const path = calendarId === "primary" ? `${GRAPH}/users/${user}/events` : `${GRAPH}/users/${user}/calendars/${encodeURIComponent(calendarId)}/events`;
      const result = await authed(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: event.title,
          body: { contentType: "text", content: event.description ?? "" },
          start: { dateTime: wall(event.start), timeZone: "UTC" },
          end: { dateTime: wall(event.end), timeZone: "UTC" },
          ...(event.location ? { location: { displayName: event.location } } : {}),
          transactionId: graphTransactionId(event.id),
        }),
      });
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      return id ? ok({ providerEventId: id }, "delivered", null, id) : fail(connectionError("calendar", PROVIDER, "unknown"));
    },
    async deleteEvent(_calendarId, providerEventId) {
      if (!configured()) return fail(connectionError("calendar", PROVIDER, "not_configured"));
      if (!SAFE_SEGMENT.test(providerEventId)) return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      const result = await authed(`${GRAPH}/users/${user}/events/${encodeURIComponent(providerEventId)}`, { method: "DELETE" });
      if (!result.ok && result.error.code !== "not_found") return fail(result.error);
      return ok({ deleted: true }, "delivered");
    },
    async pullEvents(input) {
      if (!configured()) return fail(connectionError("calendar", PROVIDER, "not_configured"));
      // A delta link is a full URL from Graph. Only follow links back to Graph, so a forged cursor cannot send our token elsewhere.
      if (input.syncToken && !input.syncToken.startsWith(`${GRAPH}/`)) return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      if (!input.syncToken && (!input.from || !input.to || !isUtc(input.from) || !isUtc(input.to))) return fail(connectionError("calendar", PROVIDER, "invalid_input"));
      let url = input.syncToken ?? `${GRAPH}/users/${user}/calendarView/delta?${new URLSearchParams({ startDateTime: input.from!, endDateTime: input.to! })}`;
      const events: BusyEvent[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await authed(url, { method: "GET" });
        if (!result.ok && (result.error.httpStatus === 410 || result.error.providerCode === "syncStateNotFound")) return ok({ events: [], fullResyncRequired: true }, "delivered");
        if (!result.ok) return fail(result.error);
        const items = field(result.data, "value");
        for (const item of Array.isArray(items) ? items : []) {
          const providerEventId = text(field(item, "id"));
          if (!providerEventId) continue;
          const removed = field(item, "@removed") !== undefined || field(item, "isCancelled") === true;
          if (!removed && field(item, "showAs") === "free") continue;
          events.push({ providerEventId, start: toUtc(field(item, "start", "dateTime")) ?? "", end: toUtc(field(item, "end", "dateTime")) ?? "", cancelled: removed });
        }
        const next = text(field(result.data, "@odata.nextLink"));
        const delta = text(field(result.data, "@odata.deltaLink"));
        if (next?.startsWith(`${GRAPH}/`)) {
          url = next;
          continue;
        }
        return ok({ events, ...(delta?.startsWith(`${GRAPH}/`) ? { nextSyncToken: delta } : {}), fullResyncRequired: false }, "delivered");
      }
      return ok({ events, fullResyncRequired: true }, "delivered");
    },
  };
}

export const definition: ProviderDefinition<"calendar"> = {
  info: { port: "calendar", provider: PROVIDER, kind: "live", capabilities: ["push", "pull", "incremental-sync", "idempotency"], secrets: ["MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_REFRESH_TOKEN"] },
  secrets: ["MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_REFRESH_TOKEN"],
  settings: ["MS_GRAPH_TENANT", "MS_GRAPH_USER"],
  create: ({ secrets, settings, fetch }) => {
    const tenant = /^[A-Za-z0-9.-]{1,128}$/.test(settings.MS_GRAPH_TENANT ?? "") ? settings.MS_GRAPH_TENANT : "common";
    return microsoftCalendar({
      oauth: {
        tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        clientId: secrets.MS_GRAPH_CLIENT_ID,
        clientSecret: secrets.MS_GRAPH_CLIENT_SECRET,
        refreshToken: secrets.MS_GRAPH_REFRESH_TOKEN,
        clientAuth: "body",
        scope: "offline_access https://graph.microsoft.com/Calendars.ReadWrite",
      },
      user: settings.MS_GRAPH_USER ?? "",
      fetch,
    });
  },
};
