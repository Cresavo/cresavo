import { t } from "../i18n";
import { bookingHome, widgetPath } from "./links";

/** Only public booking URLs; no customer IDs, tracking or personal details. */
export function bookingShare(origin: string, slug: string) {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid booking origin");
  const link = `${url.origin}${bookingHome(slug)}`;
  const widget = `${url.origin}${widgetPath(slug)}`;
  const code = `<iframe src="${widget}" title="${t("widget.label")}" width="100%" height="780" style="border:0;border-radius:16px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  return { link, widget, code };
}
