import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StudioShell } from "@/concept/studio/shell";
import "./studio.css";

export const metadata: Metadata = {
  title: "Studio · Salong Eko",
  description: "Clickable demo of an AI-native salon system. Fictional data only.",
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

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="studio-root">
      <StudioShell>{children}</StudioShell>
    </div>
  );
}
