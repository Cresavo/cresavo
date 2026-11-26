import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";
import { SwedishDocument } from "@/concept/showcase/document-lang";
import "../studio/studio.css";

// Two website designs for the demo salon, at /showcase/<design>. They are the salon's own
// site, not the platform's: tenant metadata (no platform name, icon or manifest), and the
// proxy treats the path like a booking page, so no platform banner (concept/page/language.ts).
// studio.css carries the booking flow's styles, as on /boka.

export const metadata: Metadata = {
  ...TENANT_METADATA,
  robots: { index: false, follow: false },
};

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return <><SwedishDocument />{children}</>;
}
