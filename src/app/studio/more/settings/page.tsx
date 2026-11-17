"use client";

import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { t } from "@/concept/i18n";
import { setupOf } from "@/concept/onboarding/setup";
import { startBusiness } from "@/concept/store";
import { BookingShare } from "@/concept/studio/more/booking-share";
import { AddressSection } from "@/concept/studio/page/address-section";
import { ClosedDaysSection } from "@/concept/studio/ops/closed-days";
import { HoursSection } from "@/concept/studio/ops/hours-section";
import { ResourcesSection } from "@/concept/studio/ops/resources-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { SupportAccess } from "@/concept/studio/support/support-access";
import { useStudio } from "@/concept/studio/use-studio";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Sheet } from "@/concept/ui/sheet";
import { ThemeControl } from "@/concept/ui/theme-control";
import { showToast } from "@/concept/ui/toast";

export default function SettingsPage() {
  const { state } = useStudio();
  const [confirming, setConfirming] = useState(false);
  const { salon } = state;
  const details = [
    [t("settings.name"), salon.name],
    [t("settings.address"), `${salon.address}, ${salon.area}`],
    [t("settings.phone"), salon.phone],
    [t("settings.email"), salon.email],
    [t("settings.orgNumber"), salon.orgNumber],
  ];

  return (
    <MorePage title={t("nav.settings")} subtitle={t("settings.subtitle")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t("settings.salon")}>
          <Card className="divide-y divide-border">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-text-secondary">{label}</span>
                <span className="text-right font-medium">{value}</span>
              </div>
            ))}
          </Card>
        </Section>
        <Section title={t("theme.label")}>
          <Card className="space-y-3 p-4">
            <p className="text-[15px] text-text-secondary">{t("theme.description")}</p>
            <ThemeControl className="w-full sm:w-auto" />
          </Card>
        </Section>
        <HoursSection />
        <ClosedDaysSection />
        <ResourcesSection />
        <AddressSection />
        <Section title={t("share.title")} className="lg:col-span-2"><BookingShare /></Section>
        <SupportAccess />
        <Section title={t("settings.demo")} className="space-y-3 lg:col-span-2">
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.startOverText")}</p>
            <ButtonLink href="/studio/welcome" variant="secondary" icon={<Sparkles size={18} />}>{t("settings.startOver")}</ButtonLink>
          </Card>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.demoText")}</p>
            <Button variant="danger" icon={<RotateCcw size={18} />} onClick={() => setConfirming(true)}>{t("settings.reset")}</Button>
          </Card>
        </Section>
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
                onClick={() => {
                  startBusiness(setupOf(state));
                  setConfirming(false);
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
