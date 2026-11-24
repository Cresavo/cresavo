"use client";

import { ChevronRight } from "lucide-react";
import { t } from "@/concept/i18n";
import { ADVANCED_NAV, moreMenu, type NavItem } from "@/concept/studio/nav";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";
import { ListRow } from "@/concept/ui/list-row";

function MenuGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <Section title={title}>
      <Card className="overflow-hidden py-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <ListRow key={item.href} href={item.href} help={item.href} title={t(item.label)}
              meta={item.description && t(item.description)}
              leading={<Icon size={22} aria-hidden className="shrink-0 text-text-secondary" />}
              trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />} />
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
    </>
  );
}
