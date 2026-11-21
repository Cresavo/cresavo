import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/concept/ui/card";
import { Wordmark } from "@/concept/ui/wordmark";
import { ownerAccountsEnabled } from "@/lib/owner-accounts";
import { isPublicReadonly } from "@/lib/public-readonly";
import "../studio/studio.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Owner account pages. They do not exist unless owner accounts are switched on. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  if (!ownerAccountsEnabled() || isPublicReadonly()) notFound();
  return (
    <div className="studio-root flex min-h-dvh items-start justify-center px-4 py-10 lg:items-center">
      <main className="w-full max-w-md space-y-6">
        <Wordmark className="w-32" />
        <Card className="p-6">{children}</Card>
      </main>
    </div>
  );
}
