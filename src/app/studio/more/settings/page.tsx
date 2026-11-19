"use client";

import { useState } from "react";
import { Compass, RotateCcw } from "lucide-react";
import { t } from "@/concept/i18n";
import { setupOf } from "@/concept/onboarding/setup";
import { dispatch, startBusiness } from "@/concept/store";
import { SalonEntry } from "@/concept/studio/onboarding/entry";
import { BookingShare } from "@/concept/studio/more/booking-share";
import { AddressSection } from "@/concept/studio/page/address-section";
import { ClosedDaysSection } from "@/concept/studio/ops/closed-days";
import { HoursSection } from "@/concept/studio/ops/hours-section";
import { ResourcesSection } from "@/concept/studio/ops/resources-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { SupportAccess } from "@/concept/studio/support/support-access";
import { parseLocale } from "@/lib/locale";
import { StudioLanguageSetting } from "@/concept/studio/studio-language";
import { useStudio } from "@/concept/studio/use-studio";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Sheet } from "@/concept/ui/sheet";
import { ThemeControl } from "@/concept/ui/theme-control";
import { showToast } from "@/concept/ui/toast";

export default function SettingsPage() {
  const { state } = useStudio();
  const [confirming, setConfirming] = useState(false);
  const { salon, localization } = state;
  const details = [
    [t("settings.name"), salon.name],
    [t("settings.address"), [salon.address, salon.area].filter(Boolean).join(", ")],
    [t("settings.phone"), salon.phone],
    [t("settings.email"), salon.email],
    [t("settings.orgNumber"), salon.orgNumber],
  ];

  return (
    <MorePage title={t("nav.settings")} subtitle={t("settings.subtitle")}>
      <SalonEntry />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t("settings.salon")}>
          <Card className="divide-y divide-hairline">
            {details.filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-text-secondary">{label}</span>
                <span className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{value}</span>
              </div>
            ))}
          </Card>
        </Section>
        <Section title={t("theme.label")}>
          <Card className="space-y-3 p-4">
            <StudioLanguageSetting />
            <p className="text-[15px] text-text-secondary">{t("theme.description")}</p>
            <ThemeControl className="w-full sm:w-auto" />
          </Card>
        </Section>
        <Section title={t("language.businessTitle")}>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-text-secondary">{t("language.businessHint")}</p>
            <label className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{t("language.businessDefault")}</span>
              <select
                className="rounded-md border border-hairline bg-surface px-3 py-2"
                value={localization.language}
                onChange={(event) => {
                  const language = parseLocale(event.currentTarget.value);
                  if (language) dispatch({ type: "salon/language", language, bilingual: localization.bilingual });
                }}
              >
                <option value="sv" lang="sv">{t("language.sv")}</option>
                <option value="en" lang="en">{t("language.en")}</option>
              </select>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localization.bilingual}
                onChange={(event) => dispatch({ type: "salon/language", language: localization.language, bilingual: event.currentTarget.checked })}
              />
              {t("language.allowBoth")}
            </label>
          </Card>
        </Section>
        <div id="hours"><HoursSection /></div>
        <ClosedDaysSection />
        <ResourcesSection />
        <AddressSection />
        <Section title={t("share.title")} className="lg:col-span-2"><div id="share"><BookingShare /></div></Section>
        <SupportAccess />
        {!state.industry && <Section title={t("settings.demo")} className="space-y-3 lg:col-span-2">
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.startOverText")}</p>
            <ButtonLink href="/studio/welcome" variant="secondary" icon={<Compass size={18} />}>{t("settings.startOver")}</ButtonLink>
          </Card>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.demoText")}</p>
            <Button variant="danger" icon={<RotateCcw size={18} />} onClick={() => setConfirming(true)}>{t("settings.reset")}</Button>
          </Card>
        </Section>}
      </div>
      {confirming && (
        <Sheet
          open
          onClose={() => setConfirming(false)}
          title={t("settings.resetTitle")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setConfirming(false);
                  await startBusiness(setupOf(state));
                  showToast(t("settings.resetDone"));
                }}
              >
                {t("settings.reset")}
              </Button>
            </>
          }
        >
          <p className="text-[15px]">{t("settings.resetText")}</p>
        </Sheet>
      )}
    </MorePage>
  );
}
