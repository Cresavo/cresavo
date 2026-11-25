"use client";

import { useEffect, useState } from "react";
import { Check, Copy, PlugZap, RotateCcw } from "lucide-react";
import { PUBLIC_DEMO } from "../../ai/api-client";
import { t, type MessageKey } from "../../i18n";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { SegmentedControl } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { SkeletonCard, SkeletonGroup } from "../../ui/feedback";
import { showToast } from "../../ui/toast";
import { claudeCodeCommand, claudeDesktopConfig, fetchProtocolInfo, shellToken, type ProtocolInfo } from "./protocol-setup";

type Client = "claude-code" | "claude-desktop" | "chatgpt";
type Status = "available" | "closed" | "lab" | "planned";

const CLIENTS: { value: Client; label: MessageKey }[] = [
  { value: "claude-code", label: "data.setup.code" },
  { value: "claude-desktop", label: "data.setup.desktop" },
  { value: "chatgpt", label: "data.setup.chatgpt" },
];

// A protocol's status is a plain word; only the one that works today is set in the primary ink.
const STATUS_TONE = { available: "accent", closed: "neutral", lab: "neutral", planned: "neutral" } as const;

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
    <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3 sm:flex-row sm:items-start">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-words text-meta leading-relaxed">{value}</code>
      <Button size="sm" variant="secondary" aria-label={label} icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy} className="self-end sm:self-start">
        {copied ? t("common.copied") : t("common.copy")}
      </Button>
    </div>
  );
}

function Steps({ items }: { items: MessageKey[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {items.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ol>
  );
}

function ClientSetup({ client, endpoint, info }: { client: Client; endpoint: string; info: ProtocolInfo }) {
  if (client === "claude-code")
    return (
      <div className="space-y-3">
        <Steps items={["data.setup.code.1", "data.setup.code.2"]} />
        <CopyField value={claudeCodeCommand(endpoint, shellToken(info))} label={t("data.copyCommand")} />
      </div>
    );
  if (client === "claude-desktop")
    return (
      <div className="space-y-3">
        <Steps items={["data.setup.desktop.1", "data.setup.desktop.2", "data.setup.desktop.3"]} />
        <CopyField value={claudeDesktopConfig(endpoint, info)} label={t("data.copyConfig")} />
      </div>
    );
  return (
    <div className="space-y-3">
      <Steps items={["data.setup.chatgpt.1", "data.setup.chatgpt.2"]} />
      <p className="rounded-md bg-warning-bg px-4 py-3 text-sm text-text">{t("data.setup.chatgpt.limit")}</p>
    </div>
  );
}

const TOKEN_TEXT: Record<ProtocolInfo["mcp"]["token"], MessageKey> = {
  "dev-default": "data.token.dev",
  env: "data.token.env",
  missing: "data.token.missing",
};

/** The server's protocol paths and token status; `failed` when it could not be read. */
export function useProtocolInfo() {
  const [result, setResult] = useState<{ info?: ProtocolInfo; failed?: boolean }>({});
  useEffect(() => {
    fetchProtocolInfo().then(
      (info) => setResult({ info }),
      () => setResult({ failed: true }),
    );
  }, []);
  return result;
}

/** How to connect Claude or ChatGPT to the demo business over MCP. */
export function ConnectSection({ info, failed }: { info?: ProtocolInfo; failed?: boolean }) {
  const [client, setClient] = useState<Client>("claude-code");
  if (failed) return <EmptyState icon={<PlugZap size={22} />} title={t("data.unavailable")} />;
  if (!info) return <SkeletonGroup><SkeletonCard lines={5} /></SkeletonGroup>;
  const endpoint = `${window.location.origin}${info.paths.mcp}`;
  return (
    <Card className="space-y-4 p-5">
      <p className="text-body">{t("data.connectText")}</p>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("data.endpoint")}</p>
        <CopyField value={endpoint} label={t("data.copyEndpoint")} />
        <p className="text-xs text-text-secondary">{t(TOKEN_TEXT[info.mcp.token], { token: info.mcp.devToken ?? "" })}</p>
      </div>
      <SegmentedControl label={t("data.setup.pick")} value={client} onChange={setClient}
        options={CLIENTS.map(({ value, label }) => ({ value, label: t(label) }))} />
      <ClientSetup client={client} endpoint={endpoint} info={info} />
      <p className="text-xs text-text-secondary">{t("data.connectNote")}</p>
    </Card>
  );
}

/** Each protocol with its status, and where its discovery document lives. */
export function ProtocolList({ info }: { info?: ProtocolInfo }) {
  const rows: { name: MessageKey; description: MessageKey; status: Status; href?: string }[] = [
    { name: "data.protocol.name.mcp", description: "data.protocol.mcp", status: PUBLIC_DEMO || info?.mcp.token === "missing" ? "closed" : "available" },
    { name: "data.protocol.name.a2a", description: "data.protocol.a2a", status: "lab", href: info?.paths.agentCard },
    { name: "data.protocol.name.usp", description: "data.protocol.usp", status: "lab", href: info?.paths.usp },
    { name: "data.protocol.name.ucp", description: "data.protocol.ucp", status: "planned" },
    { name: "data.protocol.name.acp", description: "data.protocol.acp", status: "planned" },
  ];
  const reset = async () => {
    const response = await fetch("/api/concept/proposals", { method: "DELETE" }).catch(() => null);
    showToast(response?.ok ? t("data.resetDone") : t("data.resetFailed"));
  };
  return (
    <Card className="divide-y divide-hairline overflow-hidden">
      {rows.map((p) => (
        <div key={p.name} className="flex items-start gap-3 px-4 py-3">
          <span className="w-12 shrink-0 pt-1 font-semibold">{t(p.name)}</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-text-secondary">{t(p.description)}</p>
            {p.href && (
              <a href={p.href} target="_blank" rel="noreferrer" className="inline-flex min-h-target min-w-target items-center text-meta font-medium text-action underline-offset-2 hover:underline">
                {t("data.protocol.open", { path: p.href })}
              </a>
            )}
          </div>
          <Badge tone={STATUS_TONE[p.status]}>{t(`data.status.${p.status}`)}</Badge>
        </div>
      ))}
      {!PUBLIC_DEMO && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs text-text-secondary">{t("data.resetText")}</p>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} onClick={reset}>{t("data.reset")}</Button>
        </div>
      )}
    </Card>
  );
}
