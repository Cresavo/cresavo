import Link from "next/link";
import { BookMarked, Check, ChevronRight, Repeat } from "lucide-react";
import type { NewMemory } from "../../assistant/memory";
import { scheduleText, type Routine } from "../../assistant/routines";
import type { Reply, ReplyCard } from "../../assistant/thread";
import { AnswerCard } from "../../command/answer-card";
import { ChangeRows } from "../../command/change-rows";
import { PagePreview } from "../../command/page-preview";
import type { Choice, Proposal } from "../../command/proposal";
import { t } from "../../i18n";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Button, ButtonLink } from "../../ui/button";
import { BriefList } from "./brief-list";

export interface CardActions {
  onApprove: (proposal: Extract<Proposal, { kind: "change" }>) => void;
  onDecline: () => void;
  /** Takes the request back into the message box; the proposal can then no longer be approved. */
  onEdit?: () => void;
  onPick: (choice: Choice) => void;
  onRemember: (item: NewMemory) => void;
  onRoutine: (routine: Routine, keep: boolean) => void;
  /** Present while the change this reply made can still be taken back. */
  onUndo?: () => void;
}

/** What became of a proposal or offer, in place of its buttons, with Undo while that is possible. */
function Outcome({ status, onUndo }: { status: NonNullable<Reply["status"]>; onUndo?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary">
        {status === "approved" && <Check size={16} className="text-action" />}
        {t(`assistant.status.${status}`)}
      </p>
      {onUndo && <Button size="sm" variant="secondary" onClick={onUndo}>{t("common.undo")}</Button>}
    </div>
  );
}

function Decision({ status, onUndo, approve, decline, approveLabel }: { status?: Reply["status"]; onUndo?: () => void; approve: () => void; decline: () => void; approveLabel: string }) {
  if (status) return <Outcome status={status} onUndo={onUndo} />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={approve}>{approveLabel}</Button>
      <Button size="sm" variant="ghost" onClick={decline}>{t("assistant.notNow")}</Button>
    </div>
  );
}

/** The card under an assistant reply: a proposal to approve, a choice, a number with a chart, a list, a brief or a memory. */
export function ReplyCardView({ card, status, actions, failure }: { card: ReplyCard; status?: Reply["status"]; actions: CardActions; failure?: ActionFailureInfo }) {
  switch (card.kind) {
    case "change":
      return (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">{card.title}</p>
            {card.subtitle && <p className="text-sm text-text-secondary">{card.subtitle}</p>}
          </div>
          <ChangeRows rows={card.rows} />
          {card.preview && <PagePreview preview={card.preview} />}
          {!status && <p className="text-xs text-text-secondary">{t("command.proposalNote")}</p>}
          {failure ? <ActionFailure failure={failure} /> : status ? (
            <Outcome status={status} onUndo={actions.onUndo} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={card.destructive ? "danger" : "secondary"} onClick={() => actions.onApprove(card)}>{t("command.approve")}</Button>
              {actions.onEdit && <Button size="sm" variant="secondary" onClick={actions.onEdit}>{t("assistant.edit")}</Button>}
              <Button size="sm" variant="ghost" onClick={actions.onDecline}>{t("assistant.notNow")}</Button>
            </div>
          )}
        </div>
      );
    case "choose":
      return (
        <div className="flex flex-wrap gap-2">
          {card.choices.map((choice) => (
            <Button key={choice.label} variant="secondary" size="sm" align="start" onClick={() => actions.onPick(choice)}>
              {choice.label}
            </Button>
          ))}
        </div>
      );
    case "message":
      return card.link ? <ButtonLink href={card.link.href} size="sm" variant="secondary">{card.link.label}</ButtonLink> : null;
    case "memory-saved":
    case "memory-offer":
      return (
        <div className="space-y-3">
          <p className="flex gap-2 text-sm">
            <BookMarked size={16} className="mt-1 shrink-0 text-action" />
            <span className="font-medium">{card.item.text}</span>
          </p>
          {card.kind === "memory-offer" ? (
            <Decision status={status} onUndo={actions.onUndo} approve={() => actions.onRemember(card.item)} decline={actions.onDecline} approveLabel={t("assistant.memory.save")} />
          ) : status || actions.onUndo ? (
            <Outcome status={status ?? "approved"} onUndo={actions.onUndo} />
          ) : (
            <MemoryLink />
          )}
        </div>
      );
    case "memory-list":
      return (
        <div className="space-y-3">
          {card.items.length > 0 && (
            <ul className="space-y-2 text-sm">
              {card.items.slice(0, 8).map((item) => (
                <li key={item.id} className="flex gap-2">
                  <BookMarked size={14} className="mt-1 shrink-0 text-action" />
                  {item.text}
                </li>
              ))}
            </ul>
          )}
          <MemoryLink />
        </div>
      );
    case "brief":
      return <BriefList brief={card.brief} />;
    case "routine-offer": {
      const { routine, reason } = card.suggestion;
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-action-bg text-text"><Repeat size={18} /></span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{routine.name}</p>
              <p className="text-sm text-text-secondary">{scheduleText(routine)} · {reason}</p>
            </div>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {routine.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <Decision status={status} onUndo={actions.onUndo} approve={() => actions.onRoutine(routine, true)} decline={() => actions.onRoutine(routine, false)} approveLabel={t("assistant.routine.switchOn")} />
        </div>
      );
    }
    case "bookings":
      return card.items.length ? (
        <div className="space-y-3">
          <ul className="divide-y divide-hairline text-sm">
            {card.items.map((item) => {
              const row = (
                <>
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-text-secondary">{item.detail}</span>
                  </span>
                  {item.href && <ChevronRight size={16} aria-hidden className="mt-1 shrink-0 text-text-secondary" />}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? <Link href={item.href} className="flex min-h-11 gap-3 py-2 hover:bg-surface-2">{row}</Link> : <div className="flex gap-3 py-2">{row}</div>}
                </li>
              );
            })}
          </ul>
          {card.link && <ButtonLink href={card.link.href} size="sm" variant="secondary">{card.link.label}</ButtonLink>}
        </div>
      ) : null;
    default:
      return <AnswerCard answer={card} />;
  }
}

function MemoryLink() {
  return (
    <Link href="/studio/more/memory" className="inline-flex min-h-target min-w-target items-center gap-1 text-meta font-medium text-action">
      {t("nav.memory")}
      <ChevronRight size={14} />
    </Link>
  );
}
