import type { Metadata } from "next";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";
import { UnknownAddress } from "@/concept/booking/unknown-address";
import "../studio/studio.css";

export const metadata: Metadata = { ...TENANT_METADATA, title: "No booking page here", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ host?: string }> }) {
  const { host } = await searchParams;
  return (
    <div className="studio-root booking-boundary">
      <UnknownAddress host={host?.slice(0, 100)} />
    </div>
  );
}
