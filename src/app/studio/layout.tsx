import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/concept/brand";
import { StudioShell } from "@/concept/studio/shell";
import "./studio.css";

export const metadata: Metadata = {
  title: `Studio · Salong Eko · ${BRAND.name}`,
  description: `${BRAND.name}: ${BRAND.tagline} A demo studio for a fictional salon. Changes stay in this browser.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="studio-root">
      <StudioShell>{children}</StudioShell>
    </div>
  );
}
