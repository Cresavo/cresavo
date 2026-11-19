"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AssistantHeaderButton, AssistantLauncher } from "./assistant/assistant-launcher";
import { HelpButton } from "./help/help-button";
import { StudioLanguageSwitch } from "./studio-language";
import { canOpen, staffViewer, type Role } from "../ops/access";
import { useRole } from "../ops/role";
import { NoAccess } from "./ops/no-access";
import { RoleSwitch } from "./ops/role-switch";
import { t } from "../i18n";
import { unreadCount } from "../selectors";
import { isPreset } from "../modules/registry";
import { dispatch, useDemo } from "../store";
import type { DemoState } from "../data/types";
import { StaffAvatar } from "../ui/avatar";
import { cx } from "../ui/cx";
import { parseTheme, pinThemeColor, studioChrome } from "../ui/theme";
import { ThemeControl } from "../ui/theme-control";
import { showToast, Toaster } from "../ui/toast";
import { Wordmark } from "../ui/wordmark";
import { BUSINESS_NAV, isActivePath, MORE_TAB, PRIMARY_NAV, SETTINGS_NAV, visibleItems, type NavItem } from "./nav";
import type { MessageKey } from "../i18n";

const WELCOME_PATH = "/studio/welcome";
const PAGE_FRAME = "mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 lg:mx-0 lg:max-w-[78rem] lg:px-8 lg:pt-7";

/**
 * Studio links can select a starting preset with `/studio?start=essentials` or `?start=everything`. The choice only
 * sets the module switches (More → Features changes it back); the parameter is dropped so a reload does not repeat it.
 */
function useStartPreset(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const preset = url.searchParams.get("start");
    if (!isPreset(preset)) return;
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url);
    dispatch({ type: "module/preset", preset });
    showToast(t(`features.preset.${preset}.started`));
  }, [ready]);
}

export function StudioShell({ children }: { children: ReactNode }) {
  const state = useDemo();
  const role = useRole();
  const pathname = usePathname() ?? "";
  const isSetup = pathname === "/studio/setup" && role === "owner";
  // The chrome follows the studio's saved theme, also when arriving by an in-app link from a booking page.
  useEffect(() => pinThemeColor(studioChrome(parseTheme(document.documentElement.dataset.theme))), []);
  useStartPreset(!!state);
  if (!state) return <LoadingScreen />;
  if (pathname === WELCOME_PATH || isSetup) {
    return (
      <>
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <Wordmark className="w-[112px]" />
          {isSetup && <StudioLanguageSwitch />}
        </header>
        <main className="px-4 pb-12 pt-5 sm:px-6">{children}</main>
        <Toaster />
      </>
    );
  }
  return (
    <>
      <Sidebar state={state} pathname={pathname} role={role} />
      <header className="flex min-h-14 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)] max-[299px]:gap-1 max-[299px]:px-2 sm:px-6 lg:hidden">
        <Link href="/studio" aria-label={t("shell.home")} className="-ml-1 flex min-h-11 min-w-0 items-center px-1">
          <Wordmark className="w-[112px] max-[299px]:w-[96px]" />
        </Link>
        <div className="flex shrink-0 items-center gap-1 max-[299px]:gap-0">
          {state.modules.assistant && <AssistantHeaderButton />}
          <RoleSwitch compact />
          <HelpButton compact />
        </div>
      </header>
      {/* Keep the last item clear of the tab bar. */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
        {/* One frame for every page. On a desktop the content starts a fixed gutter from the sidebar and grows to a
            readable maximum; it is never centred in the space that is left, so pages do not float. The assistant
            and Help sit in each page's title row (PageHeader), on the same right edge as the content. */}
        <div className={PAGE_FRAME}>
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
        "flex min-h-10 items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
        active ? "bg-surface-2 font-semibold text-text" : "text-text-secondary hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{t(item.label)}</span>
      {!!badge && <span className="rounded-full bg-action px-2 py-0.5 text-xs font-semibold text-on-action">{badge}</span>}
    </Link>
  );
}

type GroupId = "business" | "settings";

const inGroup = (items: NavItem[], pathname: string) => items.some((item) => isActivePath(pathname, item.href));

/** The group that is open by itself: the one the page is in. On the main pages that is Business, when the screen is tall enough for it. */
function groupOf(pathname: string, tall: boolean): GroupId | null {
  if (inGroup(SETTINGS_NAV, pathname)) return "settings";
  return tall || inGroup(BUSINESS_NAV, pathname) ? "business" : null;
}

const SHORT_SCREEN = "(max-height: 859px)";

function useTallScreen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(SHORT_SCREEN);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => !window.matchMedia(SHORT_SCREEN).matches,
    () => true,
  );
}

function Sidebar({ state, pathname, role }: { state: DemoState; pathname: string; role: Role }) {
  const unread = unreadCount(state);
  const person = role === "staff" ? (staffViewer(state) ?? state.staff[0]) : state.staff[0];
  const allowed = (items: NavItem[]) => visibleItems(items, state.modules).filter((item) => canOpen(role, item.href));
  const groups: { id: GroupId; title: MessageKey; items: NavItem[] }[] = [
    { id: "business" as const, title: "nav.section.business" as const, items: allowed(BUSINESS_NAV) },
    { id: "settings" as const, title: "nav.section.settings" as const, items: allowed(SETTINGS_NAV) },
  ].filter((group) => group.items.length);
  // One group is open at a time, so the whole menu fits a laptop screen without a scrollbar of its own.
  // The page you are on decides which; a choice made by hand lasts until you go somewhere else.
  const [choice, setChoice] = useState<{ pathname: string; open: GroupId | null } | null>(null);
  const tall = useTallScreen();
  const open = choice?.pathname === pathname ? choice.open : groupOf(pathname, tall);
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-hairline bg-surface px-4 pb-3 pt-5 lg:flex">
      <Link href="/studio" aria-label={t("shell.home")} className="block px-3">
        <svg aria-hidden="true" width="124" viewBox="4.96 -74.73 358.98 77" className="h-auto fill-[light-dark(#4f364b,#fff)]">
          <use href="/brand/studio-wordmark.svg#lettering" />
        </svg>
      </Link>
      <p className="mt-3 truncate px-3 text-sm text-text-secondary">
        <span className="font-semibold text-text">{state.salon.name}</span> · {t("shell.demo")}
      </p>
      <nav aria-label={t("shell.navigation")} className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="space-y-0.5">
          {PRIMARY_NAV.filter((item) => canOpen(role, item.href)).map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} badge={item.href === "/studio/inbox" ? unread : undefined} />
          ))}
        </div>
        {groups.map((group) => {
          const expanded = open === group.id;
          return (
            <div key={group.id} className="border-t border-hairline pt-2">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`nav-${group.id}`}
                onClick={() => setChoice({ pathname, open: expanded ? null : group.id })}
                className="flex min-h-10 w-full items-center justify-between rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-2 hover:text-text"
              >
                {t(group.title)}
                <ChevronDown size={16} aria-hidden className={cx("transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div id={`nav-${group.id}`} className="space-y-0.5 pt-0.5">
                  {group.items.map((item) => (
                    <SidebarLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {/* The footer: who is looking (with the demo's owner/staff switch beside the name) and the appearance. */}
      <div className="mt-2 space-y-2 border-t border-hairline pt-3">
        <div className="flex items-center gap-2.5 px-1">
          <StaffAvatar person={person} size="md" />
          <span className="min-w-0 flex-1 text-sm leading-tight">
            <span className="block truncate font-medium">{person.firstName} {person.lastName}</span>
            <span className="block truncate text-xs text-text-secondary">{t(role === "staff" ? "shell.staffRole" : "shell.ownerRole")}</span>
          </span>
          <RoleSwitch compact iconOnly />
        </div>
        <ThemeControl compact />
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
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
              className={cx("relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-xs", active ? "font-semibold text-text" : "font-medium text-text-secondary")}
            >
              <span className={cx("flex h-7 w-12 items-center justify-center rounded-md transition-colors max-[299px]:w-9", active && "bg-action-bg")}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {/* At 200 % zoom on a phone five labels cannot fit side by side: icons only, the label stays the accessible name. */}
              <span className="max-[299px]:sr-only">{t(item.label)}</span>
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
