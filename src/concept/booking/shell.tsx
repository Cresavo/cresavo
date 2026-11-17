"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIDGET_PATH } from "./share";
import type { ReactNode } from "react";
import { Leaf } from "lucide-react";
import { t } from "../i18n";
import { useDemo } from "../store";
import { Toaster } from "../ui/toast";
import { BOOKING_HOME, MY_BOOKINGS } from "./links";

/** Page frame for everything a customer sees: slim header, content, small footer. */
export function BookShell({ children }: { children: ReactNode }) {
  const state = useDemo();
  const widget = usePathname() === WIDGET_PATH;
  if (widget) return <main className="min-h-[100dvh] bg-eko-bg p-4">{state ? children : <p>{t("booking.loading")}</p>}<Toaster /></main>;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b print:hidden border-eko-line bg-eko-surface/80 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={BOOKING_HOME} className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-eko-accent text-eko-on-accent">
              <Leaf size={16} />
            </span>
            {t("booking.brand")}
          </Link>
          <Link href={MY_BOOKINGS} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-eko-accent hover:bg-eko-accent-soft">
            {t("booking.myBookings")}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
        {state ? children : <p className="animate-pulse py-24 text-center text-eko-muted">{t("booking.loading")}</p>}
      </main>
      <footer className="border-t print:hidden border-eko-line px-4 py-6 text-center text-xs text-eko-muted">
        {t("booking.demoNote")}{" "}
        <Link href="/studio" className="font-medium text-eko-accent underline-offset-2 hover:underline">
          {t("booking.ownerView")}
        </Link>
      </footer>
      <Toaster />
    </div>
  );
}
