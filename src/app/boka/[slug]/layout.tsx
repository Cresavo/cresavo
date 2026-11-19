import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { translate } from "@/concept/i18n";
import { DEFAULT_BOOKING_LANGUAGE } from "@/concept/i18n/business";
import { BookShell } from "@/concept/booking/shell";
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

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    // The public route boundary: the page around the business's own theme (error and unknown-address states, the canvas) is the neutral tenant scope.
    <div className="studio-root booking-boundary">
      <BookShell>{children}</BookShell>
    </div>
  );
}
