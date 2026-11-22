import { cookies } from "next/headers";
import { parseLocale } from "@/lib/locale";
import { DEMO_VISITOR_COOKIE } from "@/lib/locale-cookie";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { translate } from "@/concept/i18n";
import { DEFAULT_BOOKING_LANGUAGE } from "@/concept/i18n/business";
import { serverSalonFor } from "@/lib/public-booking";
import { BookShell } from "@/concept/booking/shell";
import { ServerSalonProvider } from "@/concept/server-salon";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";
import "../../studio/studio.css";

export const metadata: Metadata = {
  ...TENANT_METADATA,
  title: translate(DEFAULT_BOOKING_LANGUAGE, "language.bookingTitle"),
  description: translate(DEFAULT_BOOKING_LANGUAGE, "language.bookingDescription"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The tenant's neutral default (tenant-theme.css), never the platform's colours.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#141415" },
  ],
};

export default async function BookingLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const visitorLanguage = parseLocale((await cookies()).get(DEMO_VISITOR_COOKIE)?.value);
  const salon = await serverSalonFor((await params).slug);
  const shell = <BookShell visitorLanguage={visitorLanguage}>{children}</BookShell>;
  return (
    // The public route boundary: the page around the business's own theme (error and unknown-address states, the canvas) is the neutral tenant scope.
    <div className="studio-root booking-boundary">
      {salon ? <ServerSalonProvider state={salon}>{shell}</ServerSalonProvider> : shell}
    </div>
  );
}
