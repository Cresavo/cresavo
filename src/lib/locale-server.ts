import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "./locale-cookie";
import { preferredLocale, type Locale } from "./locale";

export async function getLocale(): Promise<Locale> {
  return preferredLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
