import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";
import { t } from "../i18n";
import { Button, buttonClass, IconButton } from "../ui/button";
import { cx } from "../ui/cx";
import { AnswerCard } from "./answer-card";
import { ChangeRows } from "./change-rows";
import type { Choice, Proposal } from "./proposal";

export type Source = "ai" | "rules";

interface ProposalCardProps {
  proposal: Proposal;
  source: Source;
  /** An AI answer is on its way and may replace this one. */
  pending: boolean;
  onApprove: (action: Extract<Proposal, { kind: "change" }>) => void;
  onPick: (choice: Choice) => void;
  onEdit: () => void;
  onClose: () => void;
}

/** Result of a command: a change to approve, a choice to make, an answer or a note. */
export function ProposalCard({ proposal, source, pending, onApprove, onPick, onEdit, onClose }: ProposalCardProps) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            source === "ai" ? "bg-eko-accent-soft text-eko-accent" : "bg-eko-sunken text-eko-muted",
          )}
        >
          {source === "ai" && <Sparkles size={12} />}
          {source === "ai" ? t("command.source.ai") : t("command.source.rules")}
        </span>
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-eko-muted">
            <Loader2 size={12} className="animate-spin" />
            {t("command.checkingAi")}
          </span>
        )}
        <IconButton label={t("common.close")} onClick={onClose} className="ml-auto -mr-2 -mt-2 size-9">
          <X size={18} />
        </IconButton>
      </div>
      <Body proposal={proposal} onApprove={onApprove} onPick={onPick} onEdit={onEdit} onClose={onClose} />
    </div>
  );
}

type BodyProps = Pick<ProposalCardProps, "proposal" | "onApprove" | "onPick" | "onEdit" | "onClose">;

function Body({ proposal, onApprove, onPick, onEdit, onClose }: BodyProps) {
  switch (proposal.kind) {
    case "change":
      return (
        <>
          <div>
            <p className="font-semibold">{proposal.title}</p>
            {proposal.subtitle && <p className="text-sm text-eko-muted">{proposal.subtitle}</p>}
          </div>
          <ChangeRows rows={proposal.rows} />
          <p className="text-xs text-eko-muted">{t("command.proposalNote")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={proposal.destructive ? "danger" : "primary"} onClick={() => onApprove(proposal)}>{t("command.approve")}</Button>
            <Button variant="secondary" onClick={onEdit}>{t("command.edit")}</Button>
            <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          </div>
        </>
      );
    case "choose":
      return (
        <>
          <p className="font-semibold">{proposal.title}</p>
          <div className="flex flex-wrap gap-2">
            {proposal.choices.map((choice) => (
              <button key={choice.label} type="button" onClick={() => onPick(choice)} className={buttonClass("secondary", "md", "whitespace-normal text-left")}>
                {choice.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>{t("command.edit")}</Button>
        </>
      );
    case "message":
      return (
        <>
          <p className="text-[15px]">{proposal.text}</p>
          <div className="flex flex-wrap gap-2">
            {proposal.link && <Link href={proposal.link.href} className={buttonClass("primary")}>{proposal.link.label}</Link>}
            <Button variant="secondary" onClick={onEdit}>{t("command.edit")}</Button>
          </div>
        </>
      );
    default:
      return <AnswerCard answer={proposal} />;
  }
}
