"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, Mic, SquarePen, Volume2, VolumeX } from "lucide-react";
import type { Message } from "../../assistant/thread";
import { useSpeech } from "../../command/use-speech";
import { t } from "../../i18n";
import { isBookingOrPaymentAction } from "../../support/action-reference";
import { ActionFailure } from "../../ui/action-failure";
import { Button, IconButton } from "../../ui/button";
import { Textarea } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { cx } from "../../ui/cx";
import { replyUndoBlockReason } from "./reply-actions";
import { ReplyCardView, type CardActions } from "./reply-card";
import { canSpeak, stopSpeaking } from "./speak";
import { closeAssistant, setSpeak, takePendingQuestion } from "./thread-store";
import { useAssistant } from "./use-assistant";
import { undoBlockMessageKey } from "../log/undo-toast";

/** The conversation with the assistant: full screen on phones, a side panel on larger screens. */
export function AssistantPanel() {
  const assistant = useAssistant();
  const { thread } = assistant;
  return (
    <Sheet
      variant="side"
      open={thread.open}
      onClose={closeAssistant}
      title={t("assistant.title")}
      headerActions={<>
        {canSpeak() && (
          <IconButton
            label={thread.speak ? t("assistant.speakOff") : t("assistant.speakOn")}
            aria-pressed={thread.speak}
            onClick={() => {
              if (thread.speak) stopSpeaking();
              setSpeak(!thread.speak);
            }}
          >
            {thread.speak ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
          </IconButton>
        )}
        {thread.messages.length > 0 && (
          <IconButton label={t("assistant.new")} onClick={assistant.newConversation}>
            <SquarePen size={18} aria-hidden />
          </IconButton>
        )}
      </>}
    >
      <PanelBody key={assistant.role} assistant={assistant} />
    </Sheet>
  );
}

function PanelBody({ assistant }: { assistant: ReturnType<typeof useAssistant> }) {
  const { thread, send } = assistant;
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech({
    onText: (heard) => {
      setText("");
      send(heard, "voice");
    },
  });
  const { start: startListening } = speech;

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    const question = takePendingQuestion();
    if (question) send(question);
    else if (thread.listen) startListening();
    // The dialog opens (and focuses its first button) after this effect: the message box takes focus once it has.
    else window.setTimeout(() => input.current?.focus(), 0);
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (thread.messages.length) end.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  /** Edit on a proposal: the owner's words come back into the box to be changed and sent again. */
  const edit = (id: string) => {
    const words = assistant.edit(id);
    if (words === null) return;
    setText(words);
    input.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(text);
    setText("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* A link in a reply leads to another page: the panel steps aside. */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t("assistant.conversation")}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) closeAssistant();
        }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {thread.messages.map((message) => (
          <MessageView key={message.id} message={message} assistant={assistant} onEdit={() => edit(message.id)} />
        ))}
        {!thread.messages.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("command.try")}</p>
            <FollowUps items={assistant.examples} onPick={send} />
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="ui-action-bar border-t border-hairline bg-surface px-3 pt-3">
        <div className="flex items-end gap-1 rounded-md bg-surface p-1 ring-1 ring-input-border focus-within:ring-2 focus-within:ring-focus">
          <Textarea
            variant="composer"
            ref={input}
            rows={1}
            value={speech.listening ? speech.interim : text}
            readOnly={speech.listening}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
            }}
            placeholder={speech.listening ? t("command.listening") : t("assistant.placeholder")}
            aria-label={t("assistant.message")}
            enterKeyHint="send"
            className="max-h-32"
          />
          {speech.supported && (
            <IconButton
              label={t("command.voice")}
              aria-pressed={speech.listening}
              onClick={speech.toggle}
              className={cx(speech.listening && "animate-pulse bg-action-bg")}
            >
              <Mic size={18} aria-hidden />
            </IconButton>
          )}
          <IconButton type="submit" label={t("assistant.send")} variant="primary" disabled={!text.trim()}>
            <ArrowUp size={18} aria-hidden />
          </IconButton>
        </div>
      </form>
    </div>
  );
}

function cardActions(assistant: ReturnType<typeof useAssistant>, id: string, undoId?: string, onEdit?: () => void): CardActions {
  return {
    onUndo: undoId ? () => assistant.undoReply(id, undoId) : undefined,
    onEdit,
    onApprove: (proposal) => assistant.approve(id, proposal),
    onDecline: () => assistant.decline(id),
    onPick: (choice) => assistant.pick(id, choice),
    onRemember: (item) => assistant.remember(id, item),
    onRoutine: (routine, keep) => (keep ? assistant.keepRoutine(id, routine) : assistant.skipRoutine(id, routine)),
  };
}

function MessageView({ message, assistant, onEdit }: { message: Message; assistant: ReturnType<typeof useAssistant>; onEdit: () => void }) {
  if (message.from === "owner") {
    return (
      <div className="ml-12 flex flex-col items-end gap-1">
        <p className="rounded-lg rounded-br-sm bg-action px-4 py-2 text-body text-on-action">{message.text}</p>
        {message.understood && <p className="text-xs text-text-secondary">{t("assistant.understood", { text: message.understood })}</p>}
      </div>
    );
  }
  const reply = message.reply!;
  const undoReason = replyUndoBlockReason(reply);
  const undoKey = undoBlockMessageKey(undoReason);
  const bookingOrPayment = reply.card?.kind === "change" && isBookingOrPaymentAction(reply.card.action.type);
  const failure = reply.status === "failed" && bookingOrPayment ? { requestId: message.id, reason: "assistant.status.failed" as const } : undefined;
  // A rule answer's text repeats its card (it is there to be read aloud); AI wording adds to it.
  const repeatsCard = reply.source === "rules" && !!reply.card && ANSWERS.has(reply.card.kind);
  return (
    <Bubble source={reply.source} text={repeatsCard ? undefined : reply.text}>
      {reply.card && (
        <ReplyCardView
          card={reply.card}
          status={reply.status}
          failure={failure}
          actions={cardActions(assistant, message.id, undoReason ? undefined : reply.undoId, reply.request ? onEdit : undefined)}
        />
      )}
      {undoKey && (bookingOrPayment
        ? <ActionFailure failure={{ requestId: `${message.id}/undo`, reason: undoKey }} />
        : <p className="text-sm text-text-secondary">{t(undoKey)}</p>)}
      {reply.followUps && !reply.status && <FollowUps items={reply.followUps} onPick={assistant.send} />}
    </Bubble>
  );
}

/** Cards that already say in words and numbers what the reply text says. */
const ANSWERS = new Set(["insight", "revenue", "customers", "stock"]);

function Bubble({ source, text, children }: { source: "rules" | "ai"; text?: string; children?: ReactNode }) {
  return (
    <div className="mr-4 space-y-3 rounded-lg rounded-bl-sm bg-surface p-4 ring-1 ring-hairline">
      {text && <p className="text-body leading-snug">{text}</p>}
      {children}
      {/* Wording by a model is said in plain words; the numbers and proposals always come from the data. */}
      {source === "ai" && <p className="text-xs text-text-secondary">{t("assistant.source.ai")}</p>}
    </div>
  );
}

function FollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item} variant="secondary" size="sm" align="start" onClick={() => onPick(item)}>
          {item}
        </Button>
      ))}
    </div>
  );
}
