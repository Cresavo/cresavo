"use client";

import { useEffect, useMemo, useState } from "react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { commandReply, replyRequest, respond } from "../../assistant/engine";
import type { NewMemory } from "../../assistant/memory";
import type { Routine } from "../../assistant/routines";
import { threadSummary, type Message } from "../../assistant/thread";
import { commandExamples } from "../../command/examples";
import { buildIntentContext } from "../../command/intent-context";
import type { Choice, Proposal } from "../../command/proposal";
import { t } from "../../i18n";
import { staffViewer } from "../../ops/access";
import { useRole } from "../../ops/role";
import type { IntentResult } from "../../intent";
import { currentState, dispatch } from "../../store";
import { useStudio } from "../use-studio";
import { speak } from "./speak";
import { applyReply, approveReply, pickReply, undoReply } from "./reply-actions";
import { addMessages, messageId, refineReply, startNewThread, updateReply, useThread } from "./thread-store";

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
    // The owner's examples mix questions with quick commands, since the panel is also where commands are typed (Ctrl/Cmd+K).
    () => (role === "owner" ? [...commandExamples(state, today, role).slice(0, 2), t("assistant.example.compare"), t("assistant.example.offer"), t("assistant.example.remember")] : commandExamples(state, today, role)),
    [state, today, role],
  );

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const input = { state, text, context: thread.context, clock: { today, minutes }, role, viewer: staffViewer(state)?.id, examples };
    const outcome = respond(input);
    const changed = outcome.effects.filter((effect) => dispatch(effect, ASSISTANT)).length > 0;
    const refining = !!outcome.command && aiReady;
    const question: Message = { id: messageId(), from: "owner", text, understood: outcome.understood !== text ? outcome.understood : undefined, at: Date.now() };
    const answer: Message = {
      id: messageId(),
      from: "assistant",
      text: outcome.reply.text,
      reply: { ...outcome.reply, undoId: changed ? lastLogId() : undefined, refining: refining || undefined },
      at: Date.now(),
    };
    const before = thread.messages;
    addMessages([question, answer], outcome.context);
    if (refining) {
      // The rules answer at once; a model's reading of the same words replaces it (and the context) a moment later,
      // unless the owner has acted on the card or moved on. Nothing changes until approved.
      runAiTask<IntentResult>("interpret-command", { text: outcome.understood, context: buildIntentContext(state, today, minutes) })
        .then(({ output, log }) => {
          if (log.source !== "ai") {
            updateReply(answer.id, {});
            return outcome.reply.text;
          }
          const reading = commandReply({ ...input, state: currentState() ?? state }, outcome.understood, output);
          return refineReply(answer.id, { ...reading.reply, source: "ai" }, reading.context) ? reading.reply.text : null;
        })
        .catch(() => {
          updateReply(answer.id, {});
          return outcome.reply.text;
        })
        .then((spoken) => spoken && thread.speak && speak(spoken));
      return;
    }
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

  const approve = (id: string, proposal: Extract<Proposal, { kind: "change" }>) => approveReply(id, proposal.action);

  const decline = (id: string) => updateReply(id, { status: "declined" });

  const pick = (id: string, choice: Choice) => {
    if ("proposal" in choice) pickReply(id, choice);
    else send(choice.text);
  };

  const remember = (id: string, item: NewMemory) => applyReply(id, { type: "memory/add", item }, ASSISTANT);

  const keepRoutine = (id: string, routine: Routine) => applyReply(id, { type: "routine/add", routine }, ASSISTANT);

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
