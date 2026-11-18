"use client";

import { Download } from "lucide-react";
import { t } from "@/concept/i18n";
import { bookingsCsv, customersCsv, download } from "@/concept/studio/more/export";
import { PUBLIC_DEMO } from "@/concept/ai/api-client";
import { AiSection } from "@/concept/studio/more/ai-section";
import { ConnectSection, ProtocolList, useProtocolInfo } from "@/concept/studio/more/connect-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { OwnKeyForm } from "@/concept/studio/more/own-key-form";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Notice } from "@/concept/ui/notice";

export default function DataPage() {
  const { state, today } = useStudio();
  const { info, failed } = useProtocolInfo();
  const exports = [
    { label: t("data.export.all"), run: () => download(`salong-eko-${today}.json`, JSON.stringify(state, null, 2), "application/json") },
    { label: t("data.export.customers"), run: () => download(`salong-eko-customers-${today}.csv`, customersCsv(state), "text/csv") },
    { label: t("data.export.bookings"), run: () => download(`salong-eko-bookings-${today}.csv`, bookingsCsv(state), "text/csv") },
  ];

  return (
    <MorePage title={t("nav.data")} subtitle={t("data.subtitle")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t("data.connect")}>
          {/* The public demo's server only reads: no outside assistant can connect, so the setup steps would lead nowhere. */}
          {PUBLIC_DEMO ? <Notice tone="info">{t("data.publicDemo")}</Notice> : <ConnectSection info={info} failed={failed} />}
        </Section>
        <div className="space-y-6">
          <Section title={t("data.protocols")}>
            <ProtocolList info={info} />
          </Section>
          <Section title={t("data.export")}>
            <Card className="space-y-3 p-5">
              <p className="text-[15px]">{t("data.exportText")}</p>
              <div className="flex flex-wrap gap-2">
                {exports.map((e) => (
                  <Button key={e.label} variant="secondary" icon={<Download size={16} />} onClick={e.run}>{e.label}</Button>
                ))}
              </div>
            </Card>
          </Section>
        </div>
      </div>
      <div className="mt-8 space-y-8">
        <Section title={t("data.ai")}>
          <AiSection />
        </Section>
        {!PUBLIC_DEMO && (
          <Section title={t("ai.ownKeySection")}>
            <OwnKeyForm />
          </Section>
        )}
      </div>
    </MorePage>
  );
}
