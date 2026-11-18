import { t } from "../i18n";
import { bookingHome, widgetPath } from "./links";

const escapeAttribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Only public booking URLs; no customer IDs, tracking or personal details. The iframe is titled with the business's name, never the platform's. */
export function bookingShare(origin: string, slug: string, salon: string) {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid booking origin");
  const link = `${url.origin}${bookingHome(slug)}`;
  const widget = `${url.origin}${widgetPath(slug)}`;
  const code = `<iframe src="${widget}" title="${escapeAttribute(t("widget.title", { salon }))}" width="100%" height="780" style="border:0;border-radius:16px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  return { link, widget, code };
}
