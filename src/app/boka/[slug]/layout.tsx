import { cookies } from "next/headers";
import { parseLocale } from "@/lib/locale";
import { DEMO_VISITOR_COOKIE } from "@/lib/locale-cookie";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { translate } from "@/concept/i18n";
import { DEFAULT_BOOKING_LANGUAGE } from "@/concept/i18n/business";
import { loadPublicSalon } from "@/lib/public-booking";
import { publicPageRequest } from "@/lib/public-page";
import { checkRateLimit } from "@/lib/rate-limit";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
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
  const { live, requestHeaders } = await publicPageRequest();
  const shell = <BookShell visitorLanguage={visitorLanguage}>{children}</BookShell>;
  // The public route boundary: the page around the business's own theme (error and unknown-address states, the canvas) is the neutral tenant scope.
  const boundary = (content: ReactNode) => <div className="studio-root booking-boundary">{content}</div>;
  if (!live) return boundary(shell);
  // Live: the server's salons only. A missing salon is a 404 and a store failure is an error page, never the browser's own copy.
  let salon;
  try {
    await checkRateLimit("public-read", waitlistClientKey(new Headers(requestHeaders)));
    salon = await loadPublicSalon((await params).slug.toLowerCase());
  } catch {
    return boundary(<main className="booking-gutters mx-auto max-w-5xl py-12"><p role="alert">{translate(DEFAULT_BOOKING_LANGUAGE, "booking.unavailable")}</p></main>);
  }
  if (!salon) notFound();
  return boundary(<ServerSalonProvider state={salon}>{shell}</ServerSalonProvider>);
}
