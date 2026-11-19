"use client";

import { ChangeRows } from "../../command/change-rows";
import { t } from "../../i18n";
import { Button, ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { usePairing } from "./session";

export function PairedInbox() {
  const pairing = usePairing();
  if (!pairing?.workspace) return null;
  const { workspace: w, busy, command } = pairing;
  return <Section title={t("pair.label")} className="mb-6">
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="space-y-2 p-5">
        <h3 className="font-semibold">{t("pair.incoming")}</h3>
        <ul className="space-y-2">{w.items.map(item => <li key={item.itemId}>
          <p>{item.untrustedCustomerText.title}</p>
          {item.untrustedAssistantText && <p className="text-sm"><strong>{t("pair.assistantByline")}</strong> · {item.untrustedAssistantText.reply}</p>}
        </li>)}</ul>
        <ButtonLink size="sm" variant="secondary" href="/studio/calendar">{t("pair.calendar")}</ButtonLink>
      </Card>
      {w.proposals.map(p => <Card key={p.proposalId} className="space-y-3 p-5 ring-1 ring-action/30">
        <p className="text-sm text-text-secondary">{t("pair.review")}</p><h3 className="font-semibold">{p.untrustedCustomerText.title}</h3>
        {p.untrustedCustomerText.incomingMessage && <div>
          <p className="text-sm font-medium">{t("pair.customerMessage")}</p>
          <blockquote className="whitespace-pre-wrap break-words border-l-2 border-hairline pl-3 text-sm text-text-secondary">{p.untrustedCustomerText.incomingMessage}</blockquote>
        </div>}
        <ChangeRows rows={p.untrustedCustomerText.changes} />
        <div className="flex gap-2">{(["approve", "decline"] as const).map(decision =>
          <Button key={decision} disabled={busy} variant={decision === "approve" ? "secondary" : "tertiary"}
            onClick={() => void command("decision", { workspaceId: w.id, proposalId: p.proposalId, decision })}>
            {t(decision === "approve" ? "agents.approve" : "agents.decline")}
          </Button>)}</div>
      </Card>)}
    </div>
  </Section>;
}
