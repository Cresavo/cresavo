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
import { useServerSalon } from "../server-salon";
import { openBookingWorkspace, usePublicDemo, useWorkspaceSlug } from "../store";
import { ButtonLink } from "../ui/button";
import { Select } from "../ui/controls";
import { Bone, SkeletonGroup, SkeletonText } from "../ui/feedback";
import { pinThemeColor } from "../ui/theme";
import { OfflineBanner } from "../ui/offline-banner";
import { CONTENT_ID, SkipLink } from "../ui/skip-link";
import { Toaster } from "../ui/toast";
import { bookingHome, myBookings, widgetPath } from "./links";
import { PageProvider, usePage } from "./page-context";
import { PageRoot } from "./page-root";
import { TENANT_ICON } from "./tenant-metadata";
import { UnknownAddress } from "./unknown-address";

/** Page frame for everything a customer sees: slim header, content, small footer, wearing the business's theme. */
export function BookShell({ children, visitorLanguage }: { children: ReactNode; visitorLanguage: Locale | null }) {
  const state = usePublicDemo();
  const fromServer = useServerSalon() !== null;
  // The server looks salons up by lower-case address; the demo compares the address and path as typed.
  const canonical = (text: string) => fromServer ? text.toLowerCase() : text;
  const slug = canonical(useParams<{ slug: string }>()?.slug ?? "");
  const path = canonical(usePathname()?.replace(/\/$/, "") || "/");
  const widget = path === widgetPath(slug) || path === "/widget";
  const otherSlug = useWorkspaceSlug(state?.industry ? "demo" : "own");
  useEffect(() => {
    if (slug === otherSlug) openBookingWorkspace(slug);
  }, [slug, otherSlug]);
  const home = path === "/" || path === `/boka/${slug}`;
  const allowSwitch = home && state?.salon.slug === slug && state.localization.bilingual;
  const [choice, setChoice] = useState<{ slug: string; language: Locale }>();
  const businessLanguage = state?.localization.language ?? DEFAULT_BOOKING_LANGUAGE;
  const demoLanguage = !state?.industry && slug === "salong-eko" ? visitorLanguage : null;
  const selectedLanguage = choice?.slug === slug ? choice.language : demoLanguage;
  const language = allowSwitch && selectedLanguage ? selectedLanguage : businessLanguage;
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

/** While the salon loads: its name, a sentence and the treatment rows with their Book buttons, as quiet blocks. */
export function PageSkeleton() {
  return (
    <SkeletonGroup className="max-w-3xl space-y-6 py-4">
      <div aria-hidden="true" className="space-y-3">
        <Bone className="h-8 w-2/3" />
        <SkeletonText lines={2} />
      </div>
      <div aria-hidden="true" className="divide-y divide-hairline">
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="flex min-h-16 items-center gap-4 py-3">
            <span className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-1/2" />
              <Bone className="h-3 w-1/3" />
            </span>
            <Bone className="h-10 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
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
  const fromServer = useServerSalon() !== null;
  const [brokenLogo, setBrokenLogo] = useState<string | null>(null);
  useTenantIcon(known && page.theme.logo !== brokenLogo ? page.theme.logo : null);
  useTenantChrome(known ? (page.theme.colors?.background ?? null) : null);
  if (!known) return <UnknownAddress />;
  if (widget) return <PageRoot page={page} className="min-h-dvh p-4"><main>{state ? children : <PageSkeleton />}</main><Toaster /></PageRoot>;
  const logo = page.theme.logo && page.theme.logo !== brokenLogo ? page.theme.logo : null;
  return (
    <PageRoot page={page} className="flex min-h-dvh flex-col">
      <SkipLink />
      {/* The route draws edge to edge (viewport-fit=cover): header, content and footer keep clear of notches and the home indicator. */}
      <header className="booking-safe-top border-b border-hairline bg-surface print:hidden">
        {/* With large text the language and My bookings move under the name instead of squeezing it. */}
        <div className="booking-gutters mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-between gap-x-3">
          <Link href={bookingHome(slug)} className="flex min-h-target min-w-0 grow basis-24 items-center gap-3 break-words font-semibold leading-tight tracking-tight">
            {logo ? (
              // The owner's logo: a small data URL in the demo, the app's own address for an account; nothing for the
              // image optimiser to do. One the server no longer serves (removed, or a page restored to an older logo) gives way to the leaf.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-8 w-auto max-w-32 rounded-sm object-contain" onError={() => setBrokenLogo(logo)} />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-sm bg-action text-on-action">
                <Leaf size={16} />
              </span>
            )}
            <span className="min-w-0">{state?.salon.name}</span>
          </Link>
          {/* Keep language and My bookings on one row. A full-width select with a larger max at `sm` used to be measured at 6rem and then laid out at 7rem, which wrapped the link from 640px. */}
          <div className="ml-auto flex max-w-full flex-nowrap items-center justify-end gap-1">
            {switchLanguage && (
              <div className="w-24 max-w-full shrink-0">
                <Select
                  aria-label={t("language.label")}
                  value={switchLanguage.language}
                  onChange={(event) => {
                    const language = parseLocale(event.currentTarget.value);
                    if (language) switchLanguage.change(language);
                  }}
                >
                  <option value="en" lang="en">{t("language.en")}</option>
                  <option value="sv" lang="sv">{t("language.sv")}</option>
                </Select>
              </div>
            )}
            {!fromServer && (
              <ButtonLink href={myBookings(slug)} size="sm" variant="tertiary" className="min-[360px]:whitespace-nowrap">
                {t("booking.myBookings")}
              </ButtonLink>
            )}
          </div>
        </div>
      </header>
      <OfflineBanner area="booking" className="booking-gutters" />
      <main id={CONTENT_ID} tabIndex={-1} className="ui-skip-target booking-gutters mx-auto w-full max-w-5xl flex-1 pb-8 pt-5 lg:pt-8">
        {state ? children : <PageSkeleton />}
      </main>
      <footer className="booking-gutters booking-safe-bottom border-t border-hairline py-4 text-center text-meta text-text-secondary print:hidden">
        {!fromServer && (
          <>
            {t("booking.demoNote")}{" "}
            <Link href={ownerView} className="inline-flex min-h-target items-center font-medium text-action underline-offset-2 hover:underline">
              {t("booking.ownerView")}
            </Link>
          </>
        )}
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
