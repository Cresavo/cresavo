import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "./locale-cookie";
import { preferredLocale, type Locale } from "./locale";

export async function getLocale(): Promise<Locale> {
  return preferredLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export function requestLocale(request: Request): Locale {
  const cookie = request.headers.get("cookie")?.split(/;\s*/).find(value => value.startsWith(LOCALE_COOKIE + "="));
  return preferredLocale(cookie?.slice(LOCALE_COOKIE.length + 1));
}
