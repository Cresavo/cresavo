"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Leaf } from "lucide-react";
import { FloatingMic } from "../command/floating-mic";
import { HelpButton } from "./help/help-button";
import { t } from "../i18n";
import { unreadCount } from "../selectors";
import { useDemo } from "../store";
import type { DemoState } from "../data/types";
import { cx } from "../ui/cx";
import { Toaster } from "../ui/toast";
import { BUSINESS_NAV, isActivePath, MORE_TAB, PRIMARY_NAV, SETTINGS_NAV, visibleItems, type NavItem } from "./nav";

export function StudioShell({ children }: { children: ReactNode }) {
  const state = useDemo();
  const pathname = usePathname() ?? "";
  if (!state) return <LoadingScreen />;
  return (
    <>
      <Sidebar state={state} pathname={pathname} />
      <main className="pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6 lg:px-10 lg:pt-5">
          <div className="mb-2 flex justify-end lg:mb-1">
            <HelpButton />
          </div>
          <Suspense>{children}</Suspense>
        </div>
      </main>
      <BottomTabs state={state} pathname={pathname} />
      <FloatingMic />
      <Toaster />
    </>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-eko-accent text-eko-on-accent">
        <Leaf size={18} />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight">Salong Eko</span>
        <span className="block text-xs text-eko-muted">{t("shell.demo")}</span>
      </span>
    </span>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

function SidebarLink({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-help={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
        active ? "bg-eko-surface font-medium text-eko-ink shadow-card" : "text-eko-muted hover:bg-eko-sunken hover:text-eko-ink",
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{t(item.label)}</span>
      {!!badge && <span className="rounded-full bg-eko-accent px-2 py-0.5 text-xs font-semibold text-eko-on-accent">{badge}</span>}
    </Link>
  );
}

function Sidebar({ state, pathname }: { state: DemoState; pathname: string }) {
  const unread = unreadCount(state);
  const owner = state.staff[0];
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-eko-line bg-eko-bg px-4 py-6 lg:flex">
      <Link href="/studio" className="px-2">
        <Logo />
      </Link>
      <nav aria-label={t("shell.navigation")} className="mt-8 flex flex-1 flex-col gap-6 overflow-y-auto">
        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} badge={item.href === "/studio/inbox" ? unread : undefined} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-eko-muted">{t("nav.section.business")}</p>
          {visibleItems(BUSINESS_NAV, state.modules).map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-eko-muted">{t("nav.section.settings")}</p>
          {SETTINGS_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-eko-sunken px-3 py-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-eko-anna-soft text-sm font-semibold text-eko-anna">
          {owner.firstName[0]}
          {owner.lastName[0]}
        </span>
        <span className="min-w-0 text-sm leading-tight">
          <span className="block font-medium">{owner.firstName} {owner.lastName}</span>
          <span className="block truncate text-xs text-eko-muted">{t("shell.ownerRole")}</span>
        </span>
      </div>
    </aside>
  );
}

function BottomTabs({ state, pathname }: { state: DemoState; pathname: string }) {
  const unread = unreadCount(state);
  return (
    <nav
      aria-label={t("shell.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-eko-line bg-eko-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {[...PRIMARY_NAV, MORE_TAB].map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          const badge = item.href === "/studio/inbox" ? unread : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-help={item.href}
              aria-current={active ? "page" : undefined}
              className={cx("relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-eko-accent" : "text-eko-muted")}
            >
              <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-eko-accent-soft")}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {t(item.label)}
              {badge > 0 && (
                <span className="absolute left-1/2 top-1.5 ml-2 min-w-[18px] rounded-full bg-eko-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
