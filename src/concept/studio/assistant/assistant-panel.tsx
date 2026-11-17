"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, Mic, SquarePen, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { suggestedRoutines } from "../../assistant/routines";
import type { Message } from "../../assistant/thread";
import { useSpeech } from "../../command/use-speech";
import { t } from "../../i18n";
import { IconButton } from "../../ui/button";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";
import { ReplyCardView, type CardActions } from "./reply-card";
import { canSpeak, stopSpeaking } from "./speak";
import { closeAssistant, setSpeak, takePendingQuestion } from "./thread-store";
import { useAssistant } from "./use-assistant";
import { useBrief } from "./use-brief";
import { BriefList } from "./brief-list";

/** The conversation with the assistant: full screen on phones, a side panel on larger screens. */
export function AssistantPanel() {
  const assistant = useAssistant();
  const { thread } = assistant;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (thread.open && !element.open) element.showModal();
    if (!thread.open && element.open) element.close();
  }, [thread.open]);

  return (
    <dialog
      ref={dialog}
      aria-label={t("assistant.title")}
      onClose={() => {
        stopSpeaking();
        closeAssistant();
      }}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-eko-bg p-0 text-eko-ink backdrop:bg-black/30 sm:ml-auto sm:w-[440px] sm:rounded-l-3xl sm:shadow-sheet"
    >
      {thread.open && <PanelBody assistant={assistant} />}
    </dialog>
  );
}

function PanelBody({ assistant }: { assistant: ReturnType<typeof useAssistant> }) {
  const { thread, aiReady, send } = assistant;
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech({
    onText: (heard) => {
      setText("");
      send(heard);
    },
  });
  const { start: startListening } = speech;

  useEffect(() => {
    const question = takePendingQuestion();
    if (question) send(question);
    else if (thread.listen) startListening();
    else input.current?.focus();
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (thread.messages.length) end.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(text);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-eko-line bg-eko-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-eko-accent text-eko-on-accent"><Sparkles size={18} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="font-semibold tracking-tight">{t("assistant.title")}</h2>
          <p className="truncate text-xs text-eko-muted">{aiReady ? t("assistant.mode.ai") : t("assistant.mode.rules")}</p>
        </div>
        {canSpeak() && (
          <IconButton
            label={thread.speak ? t("assistant.speakOff") : t("assistant.speakOn")}
            aria-pressed={thread.speak}
            onClick={() => {
              if (thread.speak) stopSpeaking();
              setSpeak(!thread.speak);
            }}
            className="size-10"
          >
            {thread.speak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
        )}
        {thread.messages.length > 0 && (
          <IconButton label={t("assistant.new")} onClick={assistant.newConversation} className="size-10">
            <SquarePen size={18} />
          </IconButton>
        )}
        <IconButton label={t("common.close")} onClick={closeAssistant} className="-mr-1 size-10">
          <X size={20} />
        </IconButton>
      </header>

      <div role="log" aria-live="polite" aria-label={t("assistant.conversation")} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {assistant.role === "owner" && <Opening assistant={assistant} />}
        {thread.messages.map((message) => (
          <MessageView key={message.id} message={message} assistant={assistant} />
        ))}
        {!thread.messages.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{t("command.try")}</p>
            <FollowUps items={assistant.examples} onPick={send} />
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="border-t border-eko-line bg-eko-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-end gap-1.5 rounded-2xl bg-eko-sunken/70 p-1.5 pl-3.5 ring-1 ring-eko-line/70 focus-within:ring-2 focus-within:ring-eko-accent">
          <textarea
            ref={input}
            rows={1}
            value={speech.listening ? speech.interim : text}
            readOnly={speech.listening}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) submit(event);
            }}
            placeholder={speech.listening ? t("command.listening") : t("assistant.placeholder")}
            aria-label={t("assistant.message")}
            enterKeyHint="send"
            className="bare-input max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] placeholder:text-eko-muted"
          />
          {speech.supported && (
            <button
              type="button"
              aria-label={t("command.voice")}
              title={t("command.voice")}
              aria-pressed={speech.listening}
              onClick={speech.toggle}
              className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl", speech.listening ? "animate-pulse bg-eko-accent-soft text-eko-accent" : "text-eko-muted hover:text-eko-ink")}
            >
              <Mic size={18} />
            </button>
          )}
          <button type="submit" aria-label={t("assistant.send")} title={t("assistant.send")} disabled={!text.trim()} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-eko-accent text-eko-on-accent disabled:opacity-40">
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

/** The brief of the moment and a routine worth switching on, as the assistant's first words. */
function Opening({ assistant }: { assistant: ReturnType<typeof useAssistant> }) {
  const { state, today, minutes } = useStudio();
  const { brief, ai } = useBrief();
  const [suggestion] = suggestedRoutines(state, { today, minutes });
  const actions = cardActions(assistant, "");
  return (
    <>
      <Bubble source={ai ? "ai" : "rules"} text={brief.title}>
        <BriefList brief={brief} />
      </Bubble>
      {suggestion && (
        <Bubble source="rules" text={t("assistant.routine.suggest")}>
          <ReplyCardView card={{ kind: "routine-offer", suggestion }} actions={actions} />
        </Bubble>
      )}
    </>
  );
}

function cardActions(assistant: ReturnType<typeof useAssistant>, id: string, undoId?: string): CardActions {
  return {
    onUndo: undoId ? () => assistant.undoReply(id, undoId) : undefined,
    onApprove: (proposal) => assistant.approve(id, proposal),
    onDecline: () => assistant.decline(id),
    onPick: (choice) => assistant.pick(id, choice),
    onRemember: (item) => assistant.remember(id, item),
    onRoutine: (routine, keep) => (keep ? assistant.keepRoutine(id, routine) : assistant.skipRoutine(id, routine)),
  };
}

function MessageView({ message, assistant }: { message: Message; assistant: ReturnType<typeof useAssistant> }) {
  if (message.from === "owner") {
    return (
      <div className="ml-10 flex flex-col items-end gap-1">
        <p className="rounded-2xl rounded-br-md bg-eko-accent px-3.5 py-2 text-[15px] text-eko-on-accent">{message.text}</p>
        {message.understood && <p className="text-xs text-eko-muted">{t("assistant.understood", { text: message.understood })}</p>}
      </div>
    );
  }
  const reply = message.reply!;
  // A rule answer's text repeats its card (it is there to be read aloud); AI wording adds to it.
  const repeatsCard = reply.source === "rules" && !!reply.card && ANSWERS.has(reply.card.kind);
  return (
    <Bubble source={reply.source} text={repeatsCard ? undefined : reply.text}>
      {reply.card && <ReplyCardView card={reply.card} status={reply.status} actions={cardActions(assistant, message.id, reply.undoId)} />}
      {reply.followUps && !reply.status && <FollowUps items={reply.followUps} onPick={assistant.send} />}
    </Bubble>
  );
}

/** Cards that already say in words and numbers what the reply text says. */
const ANSWERS = new Set(["insight", "revenue", "customers", "stock"]);

function Bubble({ source, text, children }: { source: "rules" | "ai"; text?: string; children?: ReactNode }) {
  return (
    <div className="mr-4 space-y-3 rounded-2xl rounded-bl-md bg-eko-surface p-3.5 shadow-card ring-1 ring-eko-line/70">
      <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", source === "ai" ? "bg-eko-accent-soft text-eko-accent" : "bg-eko-sunken text-eko-muted")}>
        {source === "ai" && <Sparkles size={11} />}
        {t(source === "ai" ? "assistant.source.ai" : "assistant.source.rules")}
      </span>
      {text && <p className="text-[15px] leading-snug">{text}</p>}
      {children}
    </div>
  );
}

function FollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onPick(item)} className="min-h-9 rounded-full bg-eko-surface px-3.5 py-1.5 text-left text-sm font-medium ring-1 ring-inset ring-eko-line hover:bg-eko-sunken">
          {item}
        </button>
      ))}
    </div>
  );
}
