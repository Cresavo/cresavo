import { cookies, headers } from "next/headers";
import { preferredLocale, type Locale } from "./locale";

export async function getLocale(): Promise<Locale> {
  return preferredLocale(
    (await cookies()).get("booking-locale")?.value,
    (await headers()).get("accept-language"),
  );
}
