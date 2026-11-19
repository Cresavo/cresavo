"use client";

import { usePairing } from "@/concept/studio/pairing/session";
import { ConnectCard } from "@/concept/studio/pairing/connect-card";

import { ChevronRight, Download } from "lucide-react";
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

export default function DataPage() {
  const pairing = usePairing();
  const { state, today } = useStudio();
  const { info, failed } = useProtocolInfo();
  const exports = [
    { label: t("data.export.all"), run: () => download(`salong-eko-${today}.json`, JSON.stringify(state, null, 2), "application/json") },
    { label: t("data.export.customers"), run: () => download(`salong-eko-customers-${today}.csv`, customersCsv(state), "text/csv") },
    { label: t("data.export.bookings"), run: () => download(`salong-eko-bookings-${today}.csv`, bookingsCsv(state), "text/csv") },
  ];

  return (
    <MorePage title={t("nav.data")} subtitle={t("data.subtitle")}>
      <ConnectCard />
      {/* What an owner comes here for first: getting the data out, and letting an assistant in. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
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
        {(!pairing || !PUBLIC_DEMO) && <Section title={t("data.connect")}>
          {/* The public demo's server only reads: no outside assistant can connect, so the setup steps would lead nowhere. */}
          {PUBLIC_DEMO ? <Card className="p-5 text-[15px] text-text-secondary">{t("data.publicDemo")}</Card> : <ConnectSection info={info} failed={failed} />}
        </Section>}
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
        {/* The protocol table is for whoever builds an integration, not for running the salon: folded away at the end. */}
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[17px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden size={18} className="text-text-secondary transition-transform group-open:rotate-90" />
            {t("data.developers")}
          </summary>
          <div className="mt-3 space-y-3 lg:max-w-3xl">
            <p className="text-sm text-text-secondary">{t("data.developersText")}</p>
            <ProtocolList info={info} />
          </div>
        </details>
      </div>
    </MorePage>
  );
}
