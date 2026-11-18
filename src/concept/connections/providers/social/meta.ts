// Meta Graph API publishing: Instagram (container + media_publish) and Facebook Page photos.
// Sources (checked 2026-11):
// - Versioning (v27.0 latest): https://developers.facebook.com/docs/graph-api/guides/versioning
// - Instagram content publishing: https://developers.facebook.com/documentation/instagram-platform/content-publishing
// - Publishing quota: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit
// - Page photos: https://developers.facebook.com/docs/graph-api/reference/page/photos/
// - appsecret_proof: https://developers.facebook.com/docs/graph-api/guides/secure-requests/
// - Errors: https://developers.facebook.com/docs/graph-api/guides/error-handling/, rate limits: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
// - Webhook X-Hub-Signature-256: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#validating-payloads
// - App Review: https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction
// Permissions: instagram_basic, instagram_content_publish, pages_manage_posts, pages_read_engagement, pages_show_list (Advanced Access needs App Review).
// verify: the 24 h publishing quota is 100 or 50 posts depending on the page; check content_publishing_limit before bulk posting.
// Publishing is not idempotent, so publish errors are never marked retryable. A failed media_publish leaves an
// unpublished container, which is harmless. The container is polled (status_code FINISHED) before publishing.
import { connectionError, fail, ok, type ConnectionErrorCode } from "../../core";
import type { SocialPort } from "../../ports/social";
import { hmac, safeEqual } from "../../server/crypto";
import { field, form, request, text, type Fetcher } from "../../server/http";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "meta";
// verify: bump deliberately; v27.0 was current in 2026-11.
export const GRAPH_VERSION = "v27.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const NUMERIC_ID = /^\d{5,30}$/;

const codeOf = (data: unknown) => {
  const code = Number(field(data, "error", "code"));
  const subcode = field(data, "error", "error_subcode");
  let mapped: ConnectionErrorCode | undefined;
  if (code === 190 || code === 102) mapped = "unauthorized";
  else if ([4, 17, 32, 613, 80001, 80002, 80004].includes(code)) mapped = "rate_limited";
  else if (code === 10 || (code >= 200 && code <= 299)) mapped = "forbidden";
  else if (code === 100) mapped = "invalid_input";
  return { code: mapped, providerCode: Number.isFinite(code) ? (subcode ? `${code}.${subcode}` : code) : undefined };
};

/** `sha256=<hex HMAC-SHA256 of the raw body with the app secret>`. */
export function verifyMetaSignature(appSecret: string, header: string | undefined, rawBody: string): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  return safeEqual(header, `sha256=${hmac("sha256", appSecret, rawBody, "hex")}`);
}

export const appSecretProof = (accessToken: string, appSecret: string) => hmac("sha256", appSecret, accessToken, "hex");

const CONTAINER_POLLS = 5;
const CONTAINER_WAIT_MS = 2000;

export function metaSocial(options: { pageAccessToken: string; appSecret: string; pageId?: string; instagramUserId?: string; fetch: Fetcher; wait?: (ms: number) => Promise<void> }): SocialPort {
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const context = { port: "social" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.pageAccessToken, options.appSecret] };
  // Token and proof go in the form body, never in the URL, so they cannot end up in access logs.
  const proof = () => appSecretProof(options.pageAccessToken, options.appSecret);
  const post = (path: string, fields: Record<string, string>, idempotent: boolean) =>
    request(context, `${GRAPH}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ ...fields, access_token: options.pageAccessToken, appsecret_proof: proof() }),
    }, codeOf, { idempotent });
  // GET has no body: the token goes in the Authorization header, only the proof in the query.
  const containerStatus = (id: string) =>
    request(context, `${GRAPH}/${id}?${new URLSearchParams({ fields: "status_code", appsecret_proof: proof() })}`, { method: "GET", headers: { Authorization: `Bearer ${options.pageAccessToken}` } }, codeOf);

  return {
    info: definition.info,
    async publish(post_) {
      let url: URL | null = null;
      try {
        url = new URL(post_.imageUrl);
      } catch {
        url = null;
      }
      if (!url || url.protocol !== "https:" || !post_.caption.trim() || post_.caption.length > 2200 || !post_.reference) return fail(connectionError("social", PROVIDER, "invalid_input"));
      if (post_.channel === "facebook") {
        if (!options.pageId || !NUMERIC_ID.test(options.pageId)) return fail(connectionError("social", PROVIDER, "not_configured"));
        const result = await post(`${options.pageId}/photos`, { url: url.toString(), caption: post_.caption, published: "true" }, false);
        if (!result.ok) return fail(result.error);
        const id = text(field(result.data, "post_id")) ?? text(field(result.data, "id"));
        return id ? ok({ postId: id }, "sent", null, id) : fail(connectionError("social", PROVIDER, "unknown"));
      }
      if (!options.instagramUserId || !NUMERIC_ID.test(options.instagramUserId)) return fail(connectionError("social", PROVIDER, "not_configured"));
      const container = await post(`${options.instagramUserId}/media`, { image_url: url.toString(), caption: post_.caption }, true);
      if (!container.ok) return fail(container.error);
      const creationId = text(field(container.data, "id"));
      if (!creationId || !NUMERIC_ID.test(creationId)) return fail(connectionError("social", PROVIDER, "unknown"));
      let status: unknown;
      for (let poll = 0; poll < CONTAINER_POLLS; poll++) {
        const checked = await containerStatus(creationId);
        if (!checked.ok) return fail(checked.error);
        status = field(checked.data, "status_code");
        if (status === "FINISHED") break;
        if (status === "ERROR" || status === "EXPIRED") return fail(connectionError("social", PROVIDER, "rejected", { providerCode: status }));
        await wait(CONTAINER_WAIT_MS);
      }
      if (status !== "FINISHED") return fail({ ...connectionError("social", PROVIDER, "provider_unavailable", { providerCode: "IN_PROGRESS" }), retryable: false });
      const published = await post(`${options.instagramUserId}/media_publish`, { creation_id: creationId }, false);
      if (!published.ok) return fail(published.error);
      const id = text(field(published.data, "id"));
      return id ? ok({ postId: id }, "sent", null, id) : fail(connectionError("social", PROVIDER, "unknown"));
    },
  };
}

export const definition: ProviderDefinition<"social"> = {
  info: { port: "social", provider: PROVIDER, kind: "live", capabilities: ["post-image", "instagram", "facebook"], secrets: ["META_PAGE_ACCESS_TOKEN", "META_APP_SECRET"] },
  secrets: ["META_PAGE_ACCESS_TOKEN", "META_APP_SECRET"],
  settings: ["META_PAGE_ID", "META_INSTAGRAM_USER_ID"],
  missingSettings: (s) => (s.META_PAGE_ID || s.META_INSTAGRAM_USER_ID ? [] : ["META_PAGE_ID"]),
  create: ({ secrets, settings, fetch }) =>
    metaSocial({ pageAccessToken: secrets.META_PAGE_ACCESS_TOKEN, appSecret: secrets.META_APP_SECRET, pageId: settings.META_PAGE_ID, instagramUserId: settings.META_INSTAGRAM_USER_ID, fetch }),
};
