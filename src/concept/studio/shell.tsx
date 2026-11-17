"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AssistantHeaderButton, AssistantLauncher } from "./assistant/assistant-launcher";
import { HelpButton } from "./help/help-button";
import { canOpen, staffViewer, type Role } from "../ops/access";
import { useRole } from "../ops/role";
import { NoAccess } from "./ops/no-access";
import { RoleSwitch } from "./ops/role-switch";
import { t } from "../i18n";
import { unreadCount } from "../selectors";
import { useDemo } from "../store";
import type { DemoState } from "../data/types";
import { cx } from "../ui/cx";
import { ThemeControl } from "../ui/theme-control";
import { Toaster } from "../ui/toast";
import { Wordmark } from "../ui/wordmark";
import { BUSINESS_NAV, isActivePath, MORE_TAB, PRIMARY_NAV, SETTINGS_NAV, visibleItems, type NavItem } from "./nav";

const WELCOME_PATH = "/studio/welcome";

export function StudioShell({ children }: { children: ReactNode }) {
  const state = useDemo();
  const role = useRole();
  const pathname = usePathname() ?? "";
  if (!state) return <LoadingScreen />;
  if (pathname === WELCOME_PATH) {
    return (
      <>
        <header className="px-4 pt-4 sm:px-6">
          <Wordmark className="w-[112px]" />
        </header>
        <main className="px-4 pb-12 pt-5 sm:px-6">{children}</main>
        <Toaster />
      </>
    );
  }
  return (
    <>
      <Sidebar state={state} pathname={pathname} role={role} />
      <header className="flex min-h-14 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:hidden">
        <Link href="/studio" aria-label={t("shell.home")} className="-ml-1 flex min-h-11 items-center px-1">
          <Wordmark className="w-[112px]" />
        </Link>
        <div className="flex items-center gap-1">
          {state.modules.assistant && <AssistantHeaderButton />}
          <HelpButton compact />
        </div>
      </header>
      {/* Room at the bottom for the tab bar and, on phones, the assistant button, so neither ever covers the last item. */}
      <main className="pb-[calc(9.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 lg:px-10 lg:pt-5">
          <div className="mb-2 hidden items-center justify-end gap-2 lg:flex">
            {state.modules.assistant && <AssistantHeaderButton />}
            <RoleSwitch />
            <HelpButton />
          </div>
          <Suspense>{canOpen(role, pathname) ? children : <NoAccess />}</Suspense>
        </div>
      </main>
      <BottomTabs state={state} pathname={pathname} role={role} />
      {state.modules.assistant && <AssistantLauncher />}
      <Toaster />
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <Wordmark className="w-[132px] animate-pulse" />
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
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
        active ? "bg-surface-2 font-semibold text-text" : "text-text-secondary hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{t(item.label)}</span>
      {!!badge && <span className="rounded-full bg-action px-2 py-0.5 text-xs font-semibold text-on-action">{badge}</span>}
    </Link>
  );
}

function Sidebar({ state, pathname, role }: { state: DemoState; pathname: string; role: Role }) {
  const unread = unreadCount(state);
  const person = role === "staff" ? (staffViewer(state) ?? state.staff[0]) : state.staff[0];
  const allowed = (items: NavItem[]) => visibleItems(items, state.modules).filter((item) => canOpen(role, item.href));
  const sections = [
    { title: "nav.section.business" as const, items: allowed(BUSINESS_NAV) },
    { title: "nav.section.settings" as const, items: allowed(SETTINGS_NAV) },
  ].filter((section) => section.items.length);
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <Link href="/studio" aria-label={t("shell.home")} className="block px-3">
        <Wordmark className="w-[124px]" />
      </Link>
      <p className="mt-4 px-3 text-sm text-text-secondary">
        <span className="font-semibold text-text">{state.salon.name}</span> · {t("shell.demo")}
      </p>
      <nav aria-label={t("shell.navigation")} className="mt-5 flex flex-1 flex-col gap-6 overflow-y-auto">
        <div className="space-y-1">
          {PRIMARY_NAV.filter((item) => canOpen(role, item.href)).map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} badge={item.href === "/studio/inbox" ? unread : undefined} />
          ))}
        </div>
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 pb-1 text-sm font-medium text-text-secondary">{t(section.title)}</p>
            {section.items.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>
      <ThemeControl compact className="mt-4 self-start" />
      <div className="mt-3 flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
        <span className={cx("flex size-9 items-center justify-center rounded-full text-sm font-semibold", person.id === "anna" ? "bg-staff-1-bg text-staff-1" : "bg-staff-2-bg text-staff-2")}>
          {person.firstName[0]}
          {person.lastName[0]}
        </span>
        <span className="min-w-0 text-sm leading-tight">
          <span className="block font-medium">{person.firstName} {person.lastName}</span>
          <span className="block truncate text-xs text-text-secondary">{t(role === "staff" ? "shell.staffRole" : "shell.ownerRole")} · {person.title.toLowerCase()}</span>
        </span>
      </div>
    </aside>
  );
}

function BottomTabs({ state, pathname, role }: { state: DemoState; pathname: string; role: Role }) {
  const unread = unreadCount(state);
  const tabs = [...PRIMARY_NAV, MORE_TAB].filter((item) => canOpen(role, item.href));
  return (
    <nav
      aria-label={t("shell.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          const badge = item.href === "/studio/inbox" ? unread : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-help={item.href}
              aria-current={active ? "page" : undefined}
              className={cx("relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs", active ? "font-semibold text-text" : "font-medium text-text-secondary")}
            >
              <span className={cx("flex h-7 w-12 items-center justify-center rounded-md transition-colors", active && "bg-action-bg")}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {t(item.label)}
              {badge > 0 && (
                <span className="absolute left-1/2 top-1.5 ml-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-semibold leading-[18px] text-bg">
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
