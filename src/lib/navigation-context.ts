import { text, type Locale } from "./locale";

// UI-only navigation metadata. Never use returnTo as authority.
const origin = "http://booking.invalid";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type ReturnContext = { returnTo?: string; returnKey?: string };
export function safeReturnTo(value: unknown, fallback = "/admin") {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\u0000-\u0020\\]/.test(value)
  )
    return fallback;
  const url = new URL(value, origin);
  if (
    url.origin !== origin ||
    !/^\/admin(?:\/(?:overview|services|staff|campaigns|customers(?:\/[a-zA-Z0-9_-]{1,128})?|bookings\/[a-zA-Z0-9_-]{1,128}))?$/.test(
      url.pathname,
    )
  )
    return fallback;
  return url.pathname + url.search + url.hash;
}
export function returnContext(
  raw: Record<string, unknown>,
  fallback: string,
): ReturnContext {
  return {
    returnTo: safeReturnTo(raw.returnTo, fallback),
    ...(typeof raw.returnKey === "string" && uuid.test(raw.returnKey)
      ? { returnKey: raw.returnKey }
      : {}),
  };
}
export function contextualHref(href: string, context: ReturnContext) {
  const url = new URL(href, origin);
  if (context.returnTo)
    url.searchParams.set("returnTo", safeReturnTo(context.returnTo));
  if (context.returnKey && uuid.test(context.returnKey))
    url.searchParams.set("returnKey", context.returnKey);
  return url.pathname + url.search + url.hash;
}
export function returnHref(context: ReturnContext, fallback: string) {
  const url = new URL(safeReturnTo(context.returnTo, fallback), origin);
  if (context.returnKey && uuid.test(context.returnKey))
    url.hash = `return-${context.returnKey}`;
  return url.pathname + url.search + url.hash;
}
export function returnLabel(href: string, locale: Locale = "sv") {
  const path = new URL(href, origin).pathname;
  const t = (en: string, sv: string) => text(locale, en, sv);
  if (path.startsWith("/admin/bookings/"))
    return t("Back to booking", "Till bokningen");
  if (/^\/admin\/customers\//.test(path))
    return t("Back to customer", "Till kundkortet");
  if (path === "/admin/customers") return t("Back to customers", "Till kunder");
  if (path === "/admin/overview")
    return t("Back to overview", "Till översikten");
  if (path === "/admin/services") return t("Back to services", "Till tjänster");
  if (path === "/admin/staff")
    return t("Back to team and hours", "Till personal och tider");
  if (path === "/admin/campaigns")
    return t("Back to campaigns", "Till kampanjer");
  return t("Back to calendar", "Till kalendern");
}
