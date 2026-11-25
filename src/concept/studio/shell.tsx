"use client";

import { Button } from "@/concept/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { AssistantHeaderButton, AssistantLauncher } from "./assistant/assistant-launcher";
import { HelpButton } from "./help/help-button";
import { StudioLanguageSwitch } from "./studio-language";
import { canOpen, staffViewer, type Role } from "../ops/access";
import { useRole } from "../ops/role";
import { NoAccess } from "./ops/no-access";
import { StaffPreviewBar } from "./ops/role-switch";
import { t } from "../i18n";
import { unreadCount } from "../selectors";
import { isPreset } from "../modules/registry";
import { dispatch, markTrialUsed, useDemo, useTrialRemoved } from "../store";
import { openSignedInSalon } from "../account/sync";
import type { DemoState } from "../data/types";
import { StaffAvatar } from "../ui/avatar";
import { Bone, SkeletonColumn, SkeletonGroup, SkeletonRow } from "../ui/feedback";
import { cx } from "../ui/cx";
import { parseTheme, pinThemeColor, studioChrome } from "../ui/theme";
import { ThemeToggle } from "../ui/theme-toggle";
import { showToast, Toaster } from "../ui/toast";
import { Wordmark } from "../ui/wordmark";
import { QuickActions } from "./quick-actions";
import { SearchButton } from "./search/search-button";
import { SearchPalette } from "./search/search-palette";
import { NoticesButton } from "./notices/notices-button";
import { NoticeToasts } from "./notices/notice-toasts";
import { BUSINESS_NAV, isActivePath, MORE_TAB, moreMenu, PRIMARY_NAV, SETTINGS_NAV, type NavItem } from "./nav";
import { TrialRemoved } from "./onboarding/trial-notice";
import type { MessageKey } from "../i18n";

const WELCOME_PATH = "/studio/welcome";
const PAGE_FRAME = "mx-auto w-full max-w-6xl px-4 pt-2 lg:mx-0 lg:max-w-7xl lg:px-8 lg:pt-8";

/**
 * Studio links can select a starting preset with `/studio?start=essentials` or `?start=everything`. The choice only
 * sets the module switches (More → Add-ons changes it back); the parameter is dropped so a reload does not repeat it.
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
  const removed = useTrialRemoved();
  const own = !!state?.industry;
  const preview = state && role === "staff" ? staffViewer(state) : null;
  // A signed-in owner works in their salon on the server; everyone else keeps the browser salons.
  useEffect(() => { void openSignedInSalon(); }, []);
  // The chrome follows the studio's saved theme, also when arriving by an in-app link from a booking page.
  useEffect(() => {
    const pin = () => pinThemeColor(studioChrome(parseTheme(document.documentElement.dataset.theme)));
    pin();
    // "System" follows the device, also when it switches between light and dark while the studio is open.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", pin);
    return () => scheme.removeEventListener("change", pin);
  }, []);
  useStartPreset(!!state);
  // Opening a page counts as using the trial salon; it is removed after a day without use.
  useEffect(() => { if (own) markTrialUsed(); }, [own, pathname]);
  if (!state) return <LoadingScreen calendar={pathname.startsWith("/studio/calendar")} />;
  if (removed || pathname === WELCOME_PATH || isSetup) {
    return (
      <>
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 lg:px-8">
          <Wordmark className="w-28" />
          {(isSetup || removed) && <StudioLanguageSwitch />}
        </header>
        <main className="studio-content px-4 pt-4 lg:px-8">{removed ? <TrialRemoved /> : children}</main>
        <Toaster />
      </>
    );
  }
  return (
    <>
      <Sidebar state={state} pathname={pathname} role={role} />
      <header className="studio-chrome studio-safe-top flex min-h-14 items-center bg-surface text-text justify-between gap-2 px-4 max-[374px]:gap-1 max-[299px]:flex-wrap max-[299px]:px-2 lg:hidden">
        <Link href="/studio" aria-label={t("shell.home")} className="-ml-1 flex min-h-target min-w-target items-center px-1 max-[374px]:px-0">
          <Wordmark label="" className="w-28 max-[374px]:w-24" />
        </Link>
        <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1 max-[374px]:gap-0">
          <QuickActions role={role} assistant={state.modules.assistant} page={`/boka/${state.salon.slug}`} />
          {state.modules.assistant && <AssistantHeaderButton />}
          <NoticesButton />
          <HelpButton compact />
          <ThemeToggle />
        </div>
      </header>
      {/* Keep the last item clear of the tab bar. */}
      <main className="studio-content lg:pb-12 lg:pl-64">
        {/* One frame for every page. On a desktop the content starts a fixed gutter from the sidebar and grows to a
            readable maximum; it is never centred in the space that is left, so pages do not float. The assistant
            and Help sit in each page's title row (PageHeader), on the same right edge as the content. */}
        <div className={PAGE_FRAME}>
          {preview && <StaffPreviewBar name={preview.firstName} />}
          <Suspense>{canOpen(role, pathname) ? children : <NoAccess />}</Suspense>
        </div>
      </main>
      <BottomTabs state={state} pathname={pathname} role={role} />
      {state.modules.assistant && <AssistantLauncher />}
      <SearchPalette />
      <NoticeToasts />
      <Toaster />
    </>
  );
}

/**
 * The first load: the studio's own chrome is already in place (masthead and tab bar on a phone, the sidebar on a
 * desktop) with the page as a quiet silhouette, so nothing jumps when the salon arrives.
 */
function LoadingScreen({ calendar }: { calendar: boolean }) {
  return (
    <SkeletonGroup>
      <aside aria-hidden className="studio-chrome fixed inset-y-0 left-0 hidden w-64 flex-col gap-3 bg-surface px-4 pb-3 pt-5 lg:flex">
        <span className="flex min-h-target items-center px-3"><Wordmark label="" className="w-32" /></span>
        <Bone className="mx-3 h-4 w-32" />
        <div className="mt-6 space-y-5 px-3">
          {PRIMARY_NAV.map((item) => <Bone key={item.href} className="h-4 w-28" />)}
        </div>
      </aside>
      <header aria-hidden className="studio-chrome studio-safe-top flex min-h-14 items-center bg-surface px-4 lg:hidden">
        <Wordmark label="" className="w-28" />
      </header>
      <main aria-hidden className="studio-content lg:pl-64">
        <div className={PAGE_FRAME}>
          <div className="space-y-3 pb-6 pt-4">
            <Bone className="h-8 w-48" />
            <Bone className="h-4 w-64 max-w-full" />
          </div>
          {calendar ? (
            <div className="flex gap-4">
              <SkeletonColumn />
              <SkeletonColumn className="max-sm:hidden" />
              <SkeletonColumn className="max-lg:hidden" />
            </div>
          ) : (
            <div className="rounded-lg bg-surface md:max-w-3xl">
              {Array.from({ length: 5 }, (_, row) => <SkeletonRow key={row} />)}
            </div>
          )}
        </div>
      </main>
      <div aria-hidden className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface studio-safe-bottom lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[...PRIMARY_NAV, MORE_TAB].map((item) => (
            <span key={item.href} className="flex min-h-16 flex-col items-center justify-center gap-2">
              <Bone className="size-6 rounded-full" />
              <Bone className="h-2 w-10" />
            </span>
          ))}
        </div>
      </div>
    </SkeletonGroup>
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
        "studio-nav-link flex min-h-target items-center gap-3 rounded-sm px-3 text-body transition-colors",
        active ? "studio-nav-active font-semibold" : "text-text-secondary hover:text-text",
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{t(item.label)}</span>
      {!!badge && <span className="rounded-full bg-action px-2 py-1 text-xs font-semibold text-on-action">{badge}</span>}
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
  const allowed = (items: NavItem[]) => items.filter((item) => canOpen(role, item.href));
  const menu = moreMenu(state);
  const groups: { id: GroupId; title: MessageKey; items: NavItem[] }[] = [
    { id: "business" as const, title: "nav.section.business" as const, items: allowed(menu.business) },
    { id: "settings" as const, title: "nav.section.settings" as const, items: allowed(menu.settings) },
  ].filter((group) => group.items.length);
  // One group is open at a time, so the whole menu fits a laptop screen without a scrollbar of its own.
  // The page you are on decides which; a choice made by hand lasts until you go somewhere else.
  const [choice, setChoice] = useState<{ pathname: string; open: GroupId | null } | null>(null);
  const tall = useTallScreen();
  const open = choice?.pathname === pathname ? choice.open : groupOf(pathname, tall);
  return (
    <aside className="studio-chrome fixed inset-y-0 left-0 hidden w-64 flex-col bg-surface px-4 pb-3 pt-5 text-text lg:flex">
      <Link href="/studio" aria-label={t("shell.home")} className="flex min-h-target items-center px-3">
        <Wordmark label="" className="w-32" />
      </Link>
      <p className="mt-3 truncate px-3 text-sm font-semibold">{state.salon.name}</p>
      {/* The page customers see is one click away from anywhere in the studio. */}
      <a href={`/boka/${state.salon.slug}`} target="_blank" rel="noreferrer" className="flex min-h-target items-center gap-2 rounded-md px-3 text-meta text-text-secondary underline decoration-1 underline-offset-4 hover:text-text">
        {t("quick.viewPage")}
        <ExternalLink size={14} aria-hidden />
      </a>
      <SearchButton />
      <nav aria-label={t("shell.navigation")} className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="space-y-1">
          {PRIMARY_NAV.filter((item) => canOpen(role, item.href)).map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} badge={item.href === "/studio/inbox" ? unread : undefined} />
          ))}
        </div>
        {groups.map((group) => {
          const expanded = open === group.id;
          return (
            <div key={group.id} className="pt-3">
              <Button variant="tertiary" size="sm" align="between"
                type="button"
                aria-expanded={expanded}
                aria-controls={`nav-${group.id}`}
                onClick={() => setChoice({ pathname, open: expanded ? null : group.id })}
                className="w-full text-text-secondary hover:text-text"
              >
                {t(group.title)}
                <ChevronDown size={16} aria-hidden className={cx("transition-transform", expanded && "rotate-180")} />
              </Button>
              {expanded && (
                <div id={`nav-${group.id}`} className="space-y-1 pt-1">
                  {group.items.map((item) => (
                    <SidebarLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="mt-4 flex items-center gap-3 px-1">
        <StaffAvatar person={person} size="md" />
        <span className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block truncate font-medium">{person.firstName} {person.lastName}</span>
          <span className="block truncate text-xs text-text-secondary">{t(role === "staff" ? "shell.staffRole" : "shell.ownerRole")}</span>
        </span>
      </div>
    </aside>
  );
}

function BottomTabs({ state, pathname, role }: { state: DemoState; pathname: string; role: Role }) {
  const unread = unreadCount(state);
  const tabs = [...PRIMARY_NAV, MORE_TAB].filter((item) => canOpen(role, item.href));
  const current = tabs.findIndex((item) => isActivePath(pathname, item.href));
  return (
    <nav
      aria-label={t("shell.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface studio-safe-bottom lg:hidden"
    >
      <div className="relative mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {/* One mark for the whole bar that slides to the tab you open, so the move reads as one change. */}
        {current >= 0 && (
          <span aria-hidden className="studio-tab-indicator" style={{ "--tab-index": current, "--tab-count": tabs.length } as CSSProperties}>
            <span className="h-7 w-12 rounded-full bg-action max-[299px]:w-9" />
          </span>
        )}
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
              className={cx("relative flex min-h-16 min-w-0 flex-col items-center gap-1 pt-2 text-xs max-[299px]:justify-center max-[299px]:pt-0", active ? "font-semibold text-text" : "font-medium text-text-secondary")}
            >
              <span className={cx("studio-tab-icon flex h-7 w-12 items-center justify-center max-[299px]:w-9", active && "text-on-action")}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {/* At 200 % zoom on a phone five labels cannot fit side by side: icons only, the label stays the accessible name. */}
              <span className="max-[299px]:sr-only">{t(item.label)}</span>
              {badge > 0 && (
                <span className="studio-highlight absolute left-1/2 top-1.5 ml-2 min-w-5 rounded-full px-1 text-center text-minimum font-semibold leading-normal">
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
