"use client";

import { ChevronRight } from "lucide-react";
import { bookingHome } from "@/concept/booking/links";
import { t } from "@/concept/i18n";
import { SalonEntry } from "@/concept/studio/onboarding/entry";
import { MorePage } from "@/concept/studio/more/more-page";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/concept/studio/nav";
import { StudioLanguageSetting } from "@/concept/studio/studio-language";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";
import { ListRow } from "@/concept/ui/list-row";
import { ThemeControl } from "@/concept/ui/theme-control";

/** Settings is a short overview: one row per section, each opening a page of its own. Appearance is small enough to sit here. */
export default function SettingsPage() {
  const { state } = useStudio();
  const meta: Partial<Record<SettingsSection["id"], string>> = {
    salon: state.salon.name,
    link: bookingHome(state.salon.slug),
  };
  const row = (section: SettingsSection) => {
    const Icon = section.icon;
    return (
      <li key={section.id}>
        <ListRow
          href={section.href}
          title={t(section.label)}
          meta={meta[section.id] ?? (section.description && t(section.description))}
          leading={<Icon size={22} aria-hidden className="shrink-0 text-text-secondary" />}
          trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
        />
      </li>
    );
  };
  const pages = SETTINGS_SECTIONS.filter((section) => !section.inline && section.id !== "advanced");
  const advanced = SETTINGS_SECTIONS.filter((section) => section.id === "advanced");

  return (
    <MorePage title={t("nav.settings")} subtitle={t("settings.subtitle")}>
      <SalonEntry />
      <div className="max-w-3xl space-y-6">
        <Card className="overflow-hidden p-1">
          <ul className="divide-y divide-hairline">{pages.map(row)}</ul>
        </Card>
        <div id="appearance" className="scroll-mt-4">
          <Section title={t("settings.section.appearance")}>
            <Card className="space-y-3 p-4">
              <StudioLanguageSetting />
              <p className="text-body text-text-secondary">{t("theme.description")}</p>
              <ThemeControl className="w-full sm:w-auto" />
            </Card>
          </Section>
        </div>
        {/* Advanced is one quiet row at the end: everything most salons never need. */}
        <ul aria-label={t("nav.advanced")} className="rounded-lg">{advanced.map(row)}</ul>
      </div>
    </MorePage>
  );
}
