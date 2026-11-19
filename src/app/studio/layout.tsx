import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/concept/brand";
import { StudioShell } from "@/concept/studio/shell";
import { headers } from "next/headers";
import { pairingOrigin } from "@/concept/pairing/policy";
import { PairingProvider } from "@/concept/studio/pairing/session";
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

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const enabled = !!pairingOrigin(await headers());
  return (
    <div className="studio-root">
      <StudioShell>{enabled ? <PairingProvider>{children}</PairingProvider> : children}</StudioShell>
    </div>
  );
}
