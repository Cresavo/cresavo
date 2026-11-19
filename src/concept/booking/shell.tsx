"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Leaf } from "lucide-react";
import { TENANT_POLICY } from "../brand";
import { ownerViewHref } from "../page/resolve";
import { parseLocale, type Locale } from "@/lib/locale";
import { t, translate } from "../i18n";
import { ConceptLanguage } from "../i18n/boundary";
import { DEFAULT_BOOKING_LANGUAGE, DEFAULT_CURRENCY } from "../i18n/business";
import { openBookingWorkspace, usePublicDemo, useWorkspaceSlug } from "../store";
import { pinThemeColor } from "../ui/theme";
import { Toaster } from "../ui/toast";
import { bookingHome, myBookings, widgetPath } from "./links";
import { PageProvider, usePage } from "./page-context";
import { PageRoot } from "./page-root";
import { TENANT_ICON } from "./tenant-metadata";
import { UnknownAddress } from "./unknown-address";

/** Page frame for everything a customer sees: slim header, content, small footer, wearing the business's theme. */
export function BookShell({ children }: { children: ReactNode }) {
  const state = usePublicDemo();
  const slug = useParams<{ slug: string }>()?.slug ?? "";
  const path = usePathname()?.replace(/\/$/, "") || "/";
  const widget = path === widgetPath(slug) || path === "/widget";
  const otherSlug = useWorkspaceSlug(state?.industry ? "demo" : "own");
  useEffect(() => {
    if (slug === otherSlug) openBookingWorkspace(slug);
  }, [slug, otherSlug]);
  const home = path === "/" || path === `/boka/${slug}`;
  const allowSwitch = home && state?.salon.slug === slug && state.localization.bilingual;
  const [choice, setChoice] = useState<{ slug: string; language: Locale }>();
  const businessLanguage = state?.localization.language ?? DEFAULT_BOOKING_LANGUAGE;
  const language = allowSwitch && choice?.slug === slug ? choice.language : businessLanguage;
  useEffect(() => {
    document.title = translate(language, "language.bookingTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", translate(language, "language.bookingDescription"));
  }, [language, path]);
  return (
    <ConceptLanguage language={language} currency={state?.localization.currency ?? DEFAULT_CURRENCY}>
      <PageProvider>
        <Frame slug={slug} widget={widget} switchLanguage={allowSwitch ? {
          language,
          change: (language) => setChoice({ slug, language }),
        } : undefined}>{children}</Frame>
      </PageProvider>
    </ConceptLanguage>
  );
}

function Frame({ children, slug, widget, switchLanguage }: {
  children: ReactNode;
  slug: string;
  widget: boolean;
  switchLanguage?: { language: Locale; change: (language: Locale) => void };
}) {
  const state = usePublicDemo();
  const page = usePage();
  const known = !state || state.salon.slug === slug;
  const ownerView = useOwnerView();
  useTenantIcon(known ? page.theme.logo : null);
  useTenantChrome(known ? (page.theme.colors?.background ?? null) : null);
  if (!known) return <UnknownAddress />;
  if (widget) return <PageRoot page={page} className="min-h-[100dvh] p-4"><main>{state ? children : <p>{t("booking.loading")}</p>}</main><Toaster /></PageRoot>;
  const { logo } = page.theme;
  return (
    <PageRoot page={page} className="flex min-h-[100dvh] flex-col">
      {/* The route draws edge to edge (viewport-fit=cover): header, content and footer keep clear of notches and the home indicator. */}
      <header className="border-b print:hidden border-hairline bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
          <Link href={bookingHome(slug)} className="flex min-h-11 min-w-0 items-center gap-2.5 font-semibold tracking-tight">
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
          <div className="flex items-center gap-1">
            {switchLanguage && (
              <select
                className="min-h-11 max-w-24 rounded-md bg-surface px-1 text-sm text-text"
                aria-label={t("language.label")}
                value={switchLanguage.language}
                onChange={(event) => {
                  const language = parseLocale(event.currentTarget.value);
                  if (language) switchLanguage.change(language);
                }}
              >
                <option value="sv" lang="sv">{t("language.sv")}</option>
                <option value="en" lang="en">{t("language.en")}</option>
              </select>
            )}
            <Link href={myBookings(slug)} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-text hover:bg-action-bg">
              {t("booking.myBookings")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 pb-16 pt-5 lg:pt-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        {state ? children : <p className="animate-pulse py-24 text-center text-text-secondary">{t("booking.loading")}</p>}
      </main>
      <footer className="border-t print:hidden border-hairline pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-text-secondary pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        {t("booking.demoNote")}{" "}
        <Link href={ownerView} className="font-medium text-action underline-offset-2 hover:underline">
          {t("booking.ownerView")}
        </Link>
        {TENANT_POLICY.attribution && <span className="mt-1 block">{t("booking.attribution")}</span>}
      </footer>
      <Toaster />
    </PageRoot>
  );
}

const noSubscription = () => () => {};

/** The demo-only owner link: a path on the platform's hosts, the demo site's studio on a business's own address. */
function useOwnerView(): string {
  return useSyncExternalStore(noSubscription, () => ownerViewHref(window.location.host, window.location.protocol), () => "/studio");
}

/**
 * The browser chrome wears the business's page colour when it has a palette; otherwise the
 * route's neutral theme-color tags apply. Never the studio's pinned theme, even after an in-app link.
 */
function useTenantChrome(background: string | null) {
  useEffect(() => {
    pinThemeColor(background);
    return () => pinThemeColor(null);
  }, [background]);
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
