"use client";

import { Copy, Link2 } from "lucide-react";
import { SCOPES } from "../../pairing/policy";
import { t } from "../../i18n";
import { Button, ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { usePairing } from "./session";

export function ConnectCard() {
  const pairing = usePairing();
  if (!pairing) return null;
  const { workspace, busy, ready, command } = pairing;
  const url = workspace ? window.location.origin + "/mcp/owner" : "";
  return <Section title={t("pair.connect")} className="mb-6">
    <Card className="max-w-3xl space-y-4 p-5">
      <div className="flex gap-3"><Link2 className="mt-1 shrink-0 text-action" aria-hidden />
        <p>{t(workspace ? "pair.label" : "pair.intro")}</p></div>
      {workspace ? <>
        <p role="status" className="font-medium">{workspace.client ? t("pair.connected", { client: workspace.client.clientName }) : t("pair.waiting")}
          {" · "}{t("pair.expires", { minutes: pairing.minutesLeft })}</p>
        {workspace.client && <p className="text-sm text-text-secondary">{SCOPES.filter(scope => workspace.client?.scopes.split(" ").includes(scope)).map(scope => t(`pair.${scope}`)).join(" · ")}</p>}
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 p-3">
          <code className="flex-1 break-all text-sm">{url}</code>
          <Button variant="secondary" icon={<Copy size={16}/>} onClick={() => {
            void navigator.clipboard.writeText(url).then(() => showToast(t("common.copied")), () => showToast(t("pair.selectUrl")));
          }}>{t("common.copy")}</Button>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm"><li>{t("pair.claude")}</li><li>{t("pair.signin")}</li></ol>
        <details className="text-sm"><summary className="cursor-pointer font-medium">{t("pair.chatgptTitle")}</summary><p className="mt-2">{t("pair.chatgpt")}</p></details>
        <div className="flex flex-wrap gap-2"><ButtonLink href="/studio/inbox">{t("pair.openInbox")}</ButtonLink>
          <Button variant="secondary" disabled={busy} onClick={() => void command("session", { action: "disconnect", workspaceId: workspace.id })}>{t("pair.disconnect")}</Button></div>
      </> : <Button disabled={!ready || busy} onClick={() => void command("session", { action: "start" })}>{t("pair.start")}</Button>}
    </Card>
  </Section>;
}
