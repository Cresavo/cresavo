"use client";

import { useEffect, useMemo, useState } from "react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { replyRequest, respond } from "../../assistant/engine";
import type { NewMemory } from "../../assistant/memory";
import type { Routine } from "../../assistant/routines";
import { threadSummary, type Message, type ReplyCard } from "../../assistant/thread";
import { commandExamples } from "../../command/examples";
import type { Choice, Proposal } from "../../command/proposal";
import { t } from "../../i18n";
import { staffViewer } from "../../ops/access";
import { useRole } from "../../ops/role";
import type { DemoAction } from "../../actions";
import { currentState, dispatch } from "../../store";
import { useStudio } from "../use-studio";
import { speak } from "./speak";
import { addMessages, messageId, startNewThread, updateReply, useThread } from "./thread-store";

const ASSISTANT = { actor: "owner", source: "assistant" } as const;

/** The activity log entry the last dispatch wrote. */
const lastLogId = () => currentState()?.log[0]?.id;

/** Whether the server has an AI model; rechecked when settings change. */
export function useAiReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => void isAiConfigured().then(setReady);
    refresh();
    window.addEventListener("concept-ai-settings", refresh);
    return () => window.removeEventListener("concept-ai-settings", refresh);
  }, []);
  return ready;
}

/** Everything the panel does: send a message, approve or decline a card, remember, switch on a routine. */
export function useAssistant() {
  const { state, today, minutes } = useStudio();
  const role = useRole();
  const thread = useThread();
  const aiReady = useAiReady();
  const examples = useMemo(
    () => (role === "owner" ? [t("assistant.example.compare"), t("assistant.example.offer"), t("assistant.example.remember")] : commandExamples(state, today, role)),
    [state, today, role],
  );

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const outcome = respond({ state, text, context: thread.context, clock: { today, minutes }, role, viewer: staffViewer(state)?.id, examples });
    const changed = outcome.effects.filter((effect) => dispatch(effect, ASSISTANT)).length > 0;
    const question: Message = { id: messageId(), from: "owner", text, understood: outcome.understood !== text ? outcome.understood : undefined, at: Date.now() };
    const answer: Message = { id: messageId(), from: "assistant", text: outcome.reply.text, reply: { ...outcome.reply, undoId: changed ? lastLogId() : undefined }, at: Date.now() };
    const before = thread.messages;
    addMessages([question, answer], outcome.context);
    if (!aiReady || role !== "owner") {
      if (thread.speak) speak(outcome.reply.text);
      return;
    }
    runAiTask<{ reply: string }>("assistant-reply", replyRequest(currentState() ?? state, [...before, question], outcome.understood, outcome.reply))
      .then(({ output, log }) => {
        if (log.source !== "ai") return outcome.reply.text;
        updateReply(answer.id, { text: output.reply, source: "ai" });
        return output.reply;
      })
      .catch(() => outcome.reply.text)
      .then((spoken) => thread.speak && speak(spoken));
  };

  /** Applies a change the owner approved in the panel. Undo sits on the card, since a toast would hide behind the panel. */
  const apply = (id: string, action: DemoAction, meta: Parameters<typeof dispatch>[1]) => {
    const done = dispatch(action, meta);
    updateReply(id, done ? { status: "approved", undoId: lastLogId() } : { status: "failed" });
  };

  const approve = (id: string, proposal: Extract<Proposal, { kind: "change" }>) => apply(id, proposal.action, { actor: "ai", source: "assistant" });

  const decline = (id: string) => updateReply(id, { status: "declined" });

  const undoReply = (id: string, undoId: string) => {
    dispatch({ type: "log/undo", id: undoId });
    updateReply(id, { status: "undone", undoId: undefined });
  };

  const pick = (id: string, choice: Choice) => {
    if ("proposal" in choice) updateReply(id, { card: choice.proposal as ReplyCard });
    else send(choice.text);
  };

  const remember = (id: string, item: NewMemory) => apply(id, { type: "memory/add", item }, ASSISTANT);

  const keepRoutine = (id: string, routine: Routine) => apply(id, { type: "routine/add", routine }, ASSISTANT);

  const skipRoutine = (id: string, routine: Routine) => {
    dispatch({ type: "card/dismiss", id: `routine-${routine.id}` });
    updateReply(id, { status: "declined" });
  };

  /** Ends the conversation; its topics (never its words) go into memory as a summary. */
  const newConversation = () => {
    const summary = threadSummary(startNewThread());
    if (summary) dispatch({ type: "memory/add", item: { text: summary, kind: "thread", savedOn: today, source: "assistant" } }, ASSISTANT);
  };

  return { thread, aiReady, examples, role, send, approve, decline, undoReply, pick, remember, keepRoutine, skipRoutine, newConversation };
}
