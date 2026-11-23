import type { Metadata } from "next";
import { ResetForm } from "@/concept/account/reset-form";
import { getLocale } from "@/lib/locale-server";

// The reset token travels in the address fragment; keep the page out of referrers anyway.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ResetPage() {
  return <ResetForm language={await getLocale()} />;
}
