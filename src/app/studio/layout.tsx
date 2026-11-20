import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/locale-server";
import { translate } from "@/concept/i18n";
import { BRAND } from "@/concept/brand";
import { StudioLanguage } from "@/concept/studio/studio-language";
import { StudioShell } from "@/concept/studio/shell";
import { headers } from "next/headers";
import { pairingOrigin } from "@/concept/pairing/policy";
import { PairingProvider } from "@/concept/studio/pairing/session";
import { PAGE_FONTS } from "../page-fonts";
import "./studio.css";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getLocale();
  return {
    title: translate(language, "language.studioTitle", { brand: BRAND.name }),
    description: translate(language, "language.studioDescription"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const enabled = !!pairingOrigin(await headers());
  return (
    <StudioLanguage>
      <div className={`studio-root ${PAGE_FONTS}`}>
        <StudioShell>{enabled ? <PairingProvider>{children}</PairingProvider> : children}</StudioShell>
      </div>
    </StudioLanguage>
  );
}
