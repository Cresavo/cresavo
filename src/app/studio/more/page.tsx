"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t } from "@/concept/i18n";
import { BUSINESS_NAV, SETTINGS_NAV, visibleItems, type NavItem } from "@/concept/studio/nav";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";

function MenuGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <Section title={title}>
      <Card className="divide-y divide-eko-line overflow-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-help={item.href} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-eko-sunken">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t(item.label)}</span>
                {item.description && <span className="block truncate text-sm text-eko-muted">{t(item.description)}</span>}
              </span>
              <ChevronRight size={18} className="shrink-0 text-eko-muted" />
            </Link>
          );
        })}
      </Card>
    </Section>
  );
}

export default function MorePage() {
  const { state } = useStudio();
  return (
    <>
      <PageHeader title={t("more.title")} subtitle={t("more.subtitle")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MenuGroup title={t("nav.section.business")} items={visibleItems(BUSINESS_NAV, state.modules)} />
        <MenuGroup title={t("nav.section.settings")} items={SETTINGS_NAV} />
      </div>
    </>
  );
}
