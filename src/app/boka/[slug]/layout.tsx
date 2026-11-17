import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BookShell } from "@/concept/booking/shell";
import "../../studio/studio.css";

export const metadata: Metadata = {
  title: "Book online",
  description: "Book your visit online. Demo with fictional data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#151716" },
  ],
};

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="studio-root">
      <BookShell>{children}</BookShell>
    </div>
  );
}
