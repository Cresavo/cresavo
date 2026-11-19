import { formatTime } from "../../i18n/format";
import { Bot } from "lucide-react";
import { ChangeRows } from "../../command/change-rows";
import { t, type MessageKey } from "../../i18n";
import type { AgentClient, AgentProposal } from "../../tools/agent-proposal";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";

const FROM: Record<AgentClient, MessageKey> = {
  claude: "agents.from.claude",
  chatgpt: "agents.from.chatgpt",
  agent: "agents.from.agent",
};

const timeOf = (at: number) => {
  const date = new Date(at);
  return formatTime(date.getHours() * 60 + date.getMinutes());
};

interface AgentProposalCardProps {
  proposal: AgentProposal;
  onApprove: () => void;
  onDecline: () => void;
}

/** A change an outside AI asked for, with what it would change and Approve/Decline. */
export function AgentProposalCard({ proposal, onApprove, onDecline }: AgentProposalCardProps) {
  return (
    <Card className="space-y-3 p-4 ring-1 ring-action/30 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          <Bot size={12} />
          {t(FROM[proposal.client])}
        </Badge>
        <span className="text-xs text-text-secondary">{t("agents.via", { time: timeOf(proposal.createdAt) })}</span>
      </div>
      <div>
        <p className="font-semibold">{proposal.title}</p>
        {proposal.subtitle && <p className="text-sm text-text-secondary">{proposal.subtitle}</p>}
      </div>
      <ChangeRows rows={proposal.rows} />
      <p className="text-xs text-text-secondary">{t("agents.note")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant={proposal.destructive ? "danger" : "primary"} onClick={onApprove}>{t("agents.approve")}</Button>
        <Button variant="secondary" onClick={onDecline}>{t("agents.decline")}</Button>
      </div>
    </Card>
  );
}
