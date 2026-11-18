import type { Metadata } from "next";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";
import { t } from "@/concept/i18n";
import "../studio/studio.css";

export const metadata: Metadata = { ...TENANT_METADATA, title: t("address.unknown.title"), robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="studio-root booking-boundary">{children}</div>;
}
