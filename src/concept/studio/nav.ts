import {
  BookMarked,
  CalendarDays,
  History,
  Gift,
  Inbox,
  LayoutGrid,
  Megaphone,
  Package,
  PackageOpen,
  Plug,
  Repeat,
  Settings,
  Star,
  Sun,
  Tag,
  ToggleRight,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "../i18n";
import type { ModuleKey } from "../data/types";
import { menuVisible } from "../modules/registry";

export interface NavItem {
  href: string;
  label: MessageKey;
  description?: MessageKey;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/studio", label: "nav.today", icon: Sun },
  { href: "/studio/calendar", label: "nav.calendar", icon: CalendarDays },
  { href: "/studio/customers", label: "nav.customers", icon: Users },
  { href: "/studio/inbox", label: "nav.inbox", icon: Inbox },
];

export const MORE_TAB: NavItem = { href: "/studio/more", label: "nav.more", icon: LayoutGrid };

export const BUSINESS_NAV: NavItem[] = [
  { href: "/studio/more/services", label: "nav.services", description: "nav.services.description", icon: Tag },
  { href: "/studio/more/staff", label: "nav.staff", description: "nav.staff.description", icon: UserRound },
  { href: "/studio/more/stock", label: "nav.stock", description: "nav.stock.description", icon: Package },
  { href: "/studio/more/giftcards", label: "nav.giftcards", description: "nav.giftcards.description", icon: Gift },
  { href: "/studio/more/packages", label: "nav.packages", description: "nav.packages.description", icon: PackageOpen },
  { href: "/studio/more/campaigns", label: "nav.campaigns", description: "nav.campaigns.description", icon: Megaphone },
  { href: "/studio/more/finance", label: "nav.finance", description: "nav.finance.description", icon: TrendingUp },
  { href: "/studio/more/reviews", label: "nav.reviews", description: "nav.reviews.description", icon: Star },
];

export const SETTINGS_NAV: NavItem[] = [
  { href: "/studio/more/memory", label: "nav.memory", description: "nav.memory.description", icon: BookMarked },
  { href: "/studio/more/routines", label: "nav.routines", description: "nav.routines.description", icon: Repeat },
  { href: "/studio/more/features", label: "nav.features", description: "nav.features.description", icon: ToggleRight },
  { href: "/studio/more/data", label: "nav.data", description: "nav.data.description", icon: Plug },
  { href: "/studio/more/log", label: "nav.log", description: "nav.log.description", icon: History },
  { href: "/studio/more/settings", label: "nav.settings", description: "nav.settings.description", icon: Settings },
];

export function visibleItems(items: NavItem[], modules: Record<ModuleKey, boolean>) {
  return items.filter((item) => menuVisible(modules, item.href));
}

export function isActivePath(pathname: string, href: string) {
  return href === "/studio" ? pathname === "/studio" : pathname === href || pathname.startsWith(`${href}/`);
}
