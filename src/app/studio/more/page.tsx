"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t } from "@/concept/i18n";
import { ADVANCED_NAV, moreMenu, type NavItem } from "@/concept/studio/nav";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";
import { ListRow } from "@/concept/ui/list-row";
import { ThemeControl } from "@/concept/ui/theme-control";

function MenuGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <Section title={title}>
      <Card className="divide-y divide-hairline overflow-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-help={item.href} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-surface-2">
              <Icon size={22} aria-hidden className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t(item.label)}</span>
                {item.description && <span className="block text-sm text-text-secondary">{t(item.description)}</span>}
              </span>
              <ChevronRight size={18} className="shrink-0 text-text-secondary" />
            </Link>
          );
        })}
      </Card>
    </Section>
  );
}

export default function MorePage() {
  const { state } = useStudio();
  const menu = moreMenu(state);
  return (
    <>
      <PageHeader title={t("more.title")} subtitle={t("more.subtitle")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MenuGroup title={t("nav.section.business")} items={menu.business} />
        <MenuGroup title={t("nav.section.settings")} items={menu.settings} />
      </div>
      {/* Advanced: one quiet row at the end, for what most salons never need. */}
      <ul aria-label={t("nav.advanced")} className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <li>
          <ListRow
            href={ADVANCED_NAV.href}
            title={t(ADVANCED_NAV.label)}
            meta={ADVANCED_NAV.description && t(ADVANCED_NAV.description)}
            leading={<ADVANCED_NAV.icon size={22} aria-hidden className="shrink-0 text-text-secondary" />}
            trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
          />
        </li>
      </ul>
      {/* On phones this page is the menu, so the theme control lives here (the sidebar has it on desktop). The role switch is in the top bar, where staff can reach it too. */}
      <Card className="mt-6 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="font-medium">{t("theme.label")}</span>
          <ThemeControl compact />
        </div>
      </Card>
    </>
  );
}
