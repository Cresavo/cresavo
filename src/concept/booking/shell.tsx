"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Leaf } from "lucide-react";
import { t } from "../i18n";
import { useDemo } from "../store";
import { Toaster } from "../ui/toast";
import { bookingHome, myBookings, widgetPath } from "./links";
import { PageProvider, usePage } from "./page-context";
import { PageRoot } from "./page-root";
import { TENANT_ICON } from "./tenant-metadata";
import { UnknownAddress } from "./unknown-address";

/** Page frame for everything a customer sees: slim header, content, small footer, wearing the business's theme. */
export function BookShell({ children }: { children: ReactNode }) {
  return (
    <PageProvider>
      <Frame>{children}</Frame>
    </PageProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const state = useDemo();
  const page = usePage();
  const slug = useParams<{ slug: string }>()?.slug ?? "";
  const widget = usePathname() === widgetPath(slug);
  const known = !state || state.salon.slug === slug;
  useTenantIcon(known ? page.theme.logo : null);
  if (!known) return <UnknownAddress />;
  if (widget) return <PageRoot page={page} className="min-h-[100dvh] p-4"><main>{state ? children : <p>{t("booking.loading")}</p>}</main><Toaster /></PageRoot>;
  const { logo } = page.theme;
  return (
    <PageRoot page={page} className="flex min-h-[100dvh] flex-col">
      <header className="border-b print:hidden border-border bg-surface">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={bookingHome(slug)} className="flex items-center gap-2.5 font-semibold tracking-tight">
            {logo ? (
              // A small data URL chosen by the owner; there is nothing for the image optimiser to do.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-8 w-auto max-w-32 rounded-sm object-contain" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-sm bg-action text-on-action">
                <Leaf size={16} />
              </span>
            )}
            {state?.salon.name}
          </Link>
          <Link href={myBookings(slug)} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-action hover:bg-action-bg">
            {t("booking.myBookings")}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
        {state ? children : <p className="animate-pulse py-24 text-center text-text-secondary">{t("booking.loading")}</p>}
      </main>
      <footer className="border-t print:hidden border-border px-4 py-6 text-center text-xs text-text-secondary">
        {t("booking.demoNote")}{" "}
        <Link href="/studio" className="font-medium text-action underline-offset-2 hover:underline">
          {t("booking.ownerView")}
        </Link>
      </footer>
      <Toaster />
    </PageRoot>
  );
}

/** The browser tab shows the business's logo when it has one, otherwise the neutral tenant icon from the route metadata. */
function useTenantIcon(logo: string | null) {
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const show = (href: string, type: string) => links.forEach((link) => Object.assign(link, { href, type }));
    if (logo) show(logo, "");
    return () => show(TENANT_ICON, "image/svg+xml");
  }, [logo]);
}
