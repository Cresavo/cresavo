"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { t, type MessageKey } from "@/concept/i18n";
import { bookingsCsv, customersCsv, download } from "@/concept/studio/more/export";
import { AiSection } from "@/concept/studio/more/ai-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { OwnKeyForm } from "@/concept/studio/more/own-key-form";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { showToast } from "@/concept/ui/toast";

type ProtocolStatus = "available" | "lab" | "planned";

const PROTOCOLS: { name: string; description: MessageKey; status: ProtocolStatus }[] = [
  { name: "MCP", description: "data.protocol.mcp", status: "available" },
  { name: "A2A", description: "data.protocol.a2a", status: "lab" },
  { name: "USP", description: "data.protocol.usp", status: "lab" },
  { name: "UCP", description: "data.protocol.ucp", status: "planned" },
  { name: "ACP", description: "data.protocol.acp", status: "planned" },
];

const STATUS_TONE = { available: "accent", lab: "warn", planned: "neutral" } as const;

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("data.copyFailed"));
    }
  };
  return (
    <div className="flex items-start gap-2 rounded-xl bg-eko-sunken p-3">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-[13px] leading-relaxed">{value}</code>
      <Button size="sm" variant="secondary" aria-label={label} icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy}>
        {copied ? t("common.copied") : t("common.copy")}
      </Button>
    </div>
  );
}

export default function DataPage() {
  const { state, today } = useStudio();
  const endpoint = `${window.location.origin}/api/v1/mcp`;
  const config = JSON.stringify({ mcpServers: { "salong-eko": { url: endpoint } } }, null, 2);
  const exports = [
    { label: t("data.export.all"), run: () => download(`salong-eko-${today}.json`, JSON.stringify(state, null, 2), "application/json") },
    { label: t("data.export.customers"), run: () => download(`salong-eko-customers-${today}.csv`, customersCsv(state), "text/csv") },
    { label: t("data.export.bookings"), run: () => download(`salong-eko-bookings-${today}.csv`, bookingsCsv(state), "text/csv") },
  ];

  return (
    <MorePage title={t("nav.data")} subtitle={t("data.subtitle")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t("data.connect")}>
          <Card className="space-y-4 p-5">
            <p className="text-[15px]">{t("data.connectText")}</p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("data.endpoint")}</p>
              <CopyField value={endpoint} label={t("data.copyEndpoint")} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("data.config")}</p>
              <CopyField value={config} label={t("data.copyConfig")} />
            </div>
            <p className="text-xs text-eko-muted">{t("data.connectNote")}</p>
          </Card>
        </Section>
        <div className="space-y-6">
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
          <Section title={t("data.protocols")}>
            <Card className="divide-y divide-eko-line overflow-hidden">
              {PROTOCOLS.map((p) => (
                <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 font-semibold">{p.name}</span>
                  <span className="min-w-0 flex-1 text-sm text-eko-muted">{t(p.description)}</span>
                  <Badge tone={STATUS_TONE[p.status]}>{t(`data.status.${p.status}`)}</Badge>
                </div>
              ))}
            </Card>
          </Section>
        </div>
      </div>
      <div className="mt-8 space-y-8">
        <Section title={t("data.ai")}>
          <AiSection />
        </Section>
        <Section title={t("ai.ownKeySection")}>
          <OwnKeyForm />
        </Section>
      </div>
    </MorePage>
  );
}
