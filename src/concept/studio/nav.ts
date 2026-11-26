import {
  BellRing,
  CalendarDays,
  Clock,
  Gift,
  Inbox,
  LayoutGrid,
  Link2,
  Megaphone,
  MessageCircle,
  Palette,
  Package,
  PanelsTopLeft,
  Plug,
  Settings,
  SlidersHorizontal,
  Store,
  Sun,
  Tag,
  ToggleRight,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "../i18n";
import type { DemoState, ModuleKey } from "../data/types";
import { menuVisible } from "../modules/registry";

export interface NavItem {
  href: string;
  label: MessageKey;
  description?: MessageKey;
  icon: LucideIcon;
  /** Help-map id of this item's link or row (`src/concept/help/map`). */
  helpId: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/studio", label: "nav.today", icon: Sun, helpId: "nav.today" },
  { href: "/studio/calendar", label: "nav.calendar", icon: CalendarDays, helpId: "nav.calendar" },
  { href: "/studio/customers", label: "nav.customers", icon: Users, helpId: "nav.customers" },
  { href: "/studio/inbox", label: "nav.inbox", icon: Inbox, helpId: "nav.inbox" },
];

export const MORE_TAB: NavItem = { href: "/studio/more", label: "nav.more", icon: LayoutGrid, helpId: "nav.more" };

export const BUSINESS_NAV: NavItem[] = [
  { href: "/studio/more/services", label: "nav.services", description: "nav.services.description", icon: Tag, helpId: "more.services" },
  { href: "/studio/more/booking-page", label: "nav.bookingPage", description: "nav.bookingPage.description", icon: PanelsTopLeft, helpId: "more.booking-page" },
  { href: "/studio/more/staff", label: "nav.staff", description: "nav.staff.description", icon: UserRound, helpId: "more.staff" },
  { href: "/studio/more/stock", label: "nav.stock", description: "nav.stock.description", icon: Package, helpId: "more.stock" },
  { href: "/studio/more/giftcards", label: "features.giftcards", description: "features.giftcards.description", icon: Gift, helpId: "more.giftcards" },
  { href: "/studio/more/campaigns", label: "nav.campaigns", description: "nav.campaigns.description", icon: Megaphone, helpId: "more.campaigns" },
  { href: "/studio/more/finance", label: "nav.finance", description: "nav.finance.description", icon: TrendingUp, helpId: "more.finance" },
];

/** The assistant's page holds what it remembers and its routines, as two tabs. */
export const ASSISTANT_PAGE = "/studio/more/assistant";

export const SETTINGS_NAV: NavItem[] = [
  { href: ASSISTANT_PAGE, label: "nav.assistant", description: "nav.assistant.description", icon: MessageCircle, helpId: "more.assistant" },
  { href: "/studio/more/features", label: "nav.features", description: "nav.features.description", icon: ToggleRight, helpId: "more.features" },
  { href: "/studio/more/data", label: "nav.data", description: "nav.data.description", icon: Plug, helpId: "more.data" },
  { href: "/studio/more/settings", label: "nav.settings", description: "nav.settings.description", icon: Settings, helpId: "more.settings" },
];

/** "History and undo" lives under Help (the header's help menu), not in More. */
export const HISTORY_PAGE = "/studio/more/log";

/** One quiet entry at the bottom of More and of Settings for what most salons never need. */
export const ADVANCED_PAGE = "/studio/more/advanced";
/** Under Advanced: connecting assistants and tools, keys, models, costs and the open protocols. */
export const DEVELOPERS_PAGE = "/studio/more/advanced/developers";
export const ADVANCED_NAV: NavItem = { href: ADVANCED_PAGE, label: "nav.advanced", description: "nav.advanced.description", icon: SlidersHorizontal, helpId: "more.advanced" };

export interface SettingsSection extends NavItem {
  id: "salon" | "hours" | "reminders" | "link" | "appearance" | "advanced";
  /** Shown in place on the Settings overview rather than on a page of its own. */
  inline?: boolean;
}

/**
 * The Settings overview: a short list of sections, each its own page (Appearance is small enough to
 * sit in place). Modules never add a section here; their settings live on their own pages.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: "salon", href: "/studio/more/settings/salon", label: "settings.section.salon", description: "settings.section.salon.description", icon: Store, helpId: "settings.salon" },
  { id: "hours", href: "/studio/more/settings/hours", label: "settings.section.hours", description: "settings.section.hours.description", icon: Clock, helpId: "settings.hours" },
  { id: "reminders", href: "/studio/more/settings/reminders", label: "settings.section.reminders", description: "settings.section.reminders.description", icon: BellRing, helpId: "settings.reminders" },
  { id: "link", href: "/studio/more/settings/link", label: "settings.section.link", description: "settings.section.link.description", icon: Link2, helpId: "settings.link" },
  { id: "appearance", href: "/studio/more/settings#appearance", label: "settings.section.appearance", description: "settings.section.appearance.description", icon: Palette, inline: true, helpId: "settings.appearance" },
  { id: "advanced", ...ADVANCED_NAV, helpId: "settings.advanced" },
];

export function visibleItems(items: NavItem[], modules: Record<ModuleKey, boolean>) {
  return items.filter((item) => menuVisible(modules, item.href));
}

/** What More (and the desktop sidebar's groups) list for a business: pages of switched-off modules are left out. */
export function moreMenu(state: Pick<DemoState, "modules">) {
  return {
    business: visibleItems(BUSINESS_NAV, state.modules),
    settings: visibleItems(SETTINGS_NAV, state.modules),
  };
}

export function isActivePath(pathname: string, href: string) {
  return href === "/studio" ? pathname === "/studio" : pathname === href || pathname.startsWith(`${href}/`);
}
