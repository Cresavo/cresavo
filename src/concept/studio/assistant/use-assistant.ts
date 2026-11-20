"use client";

import { useEffect, useMemo, useState } from "react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { commandReply, replyRequest, respond } from "../../assistant/engine";
import type { NewMemory } from "../../assistant/memory";
import type { Routine } from "../../assistant/routines";
import { type InputMode, type Message } from "../../assistant/thread";
import { commandExamples } from "../../command/examples";
import { buildIntentContext } from "../../command/intent-context";
import type { Choice, Proposal } from "../../command/proposal";
import { getActiveLocale, t } from "../../i18n";
import { staffViewer } from "../../ops/access";
import { currentRole, useRole } from "../../ops/role";
import type { IntentResult } from "../../intent";
import { studioSalonCopy } from "../../i18n/salon-eko-copy";
import { currentState, dispatch, dispatchWithLog } from "../../store";
import { useStudio } from "../use-studio";
import { speak } from "./speak";
import { applyReply, approveReply, editReply, pickReply, sourceFor, undoReply } from "./reply-actions";
import { addMessages, messageId, refineReply, replyOf, startNewThread, updateReply, useThread } from "./thread-store";

const ASSISTANT = { actor: "owner", source: "assistant" } as const;

/** Whether the server has an AI model; rechecked when settings change. */
export function useAiReady(localOnly: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => void isAiConfigured(localOnly).then(setReady);
    refresh();
    window.addEventListener("concept-ai-settings", refresh);
    return () => window.removeEventListener("concept-ai-settings", refresh);
  }, [localOnly]);
  return !localOnly && ready;
}

/** Everything the panel does: send a message, approve or decline a card, remember, switch on a routine. */
export function useAssistant() {
  const { state, today, minutes, target } = useStudio();
  const role = useRole();
  const thread = useThread(role);
  const localOnly = !!state.industry;
  const aiReady = useAiReady(localOnly);
  const examples = useMemo(
    // The owner's examples mix questions with quick commands, since the panel is also where commands are typed (Ctrl/Cmd+K).
    () => (role === "owner" ? [t("assistant.example.next"), t("assistant.example.room", { service: state.services[0]?.name ?? "" }), ...commandExamples(state, today, role).slice(0, 2), t("assistant.example.compare")] : [t("assistant.example.next"), ...commandExamples(state, today, role)]),
    [state, today, role],
  );

  /** `via` says whether the owner typed or spoke the words; it travels with the reply to approval and the activity log. */
  const send = (raw: string, via: InputMode = "typed") => {
    const text = raw.trim();
    if (!text || currentRole() !== role) return;
    const input = { state, text, context: thread.context, clock: { today, minutes }, role, viewer: staffViewer(state)?.id, examples };
    const outcome = respond(input);
    const logIds = outcome.effects.map((effect) => dispatchWithLog(effect, { actor: role, source: sourceFor(via) }));
    const undoId = logIds.findLast((id) => typeof id === "string");
    const refining = role === "owner" && !!outcome.command && aiReady;
    const speakReply = (spoken: string | null) => {
      if (spoken && thread.speak && currentRole() === role) speak(spoken);
    };
    const question: Message = { id: messageId(), from: "owner", text, understood: outcome.understood !== text ? outcome.understood : undefined, at: Date.now() };
    const answer: Message = {
      id: messageId(),
      from: "assistant",
      text: outcome.reply.text,
      // The salon the reply was made for: its card is approved, and its change undone, only there.
      reply: { ...outcome.reply, undoId, request: text, input: via, refining: refining || undefined, target: target ?? undefined },
      at: Date.now(),
    };
    const before = thread.messages;
    addMessages([question, answer], outcome.context, role);
    if (refining) {
      // The rules answer at once; a model's reading of the same words replaces it (and the context) a moment later,
      // unless the owner has acted on the card or moved on. Nothing changes until approved.
      runAiTask<IntentResult>("interpret-command", { text: outcome.understood, context: buildIntentContext(state, today, minutes) }, localOnly)
        .then(({ output, log }) => {
          if (log.source !== "ai") {
            updateReply(answer.id, {}, role);
            return outcome.reply.text;
          }
          const saved = currentState();
          const reading = commandReply({ ...input, state: saved ? studioSalonCopy(saved, getActiveLocale()) : state }, outcome.understood, output);
          return refineReply(answer.id, { ...reading.reply, source: "ai" }, reading.context, role) ? reading.reply.text : null;
        })
        .catch(() => {
          updateReply(answer.id, {}, role);
          return outcome.reply.text;
        })
        .then(speakReply);
      return;
    }
    // A reply about named customers stays on this device: it is never sent for rephrasing.
    if (!aiReady || role !== "owner" || outcome.local) {
      speakReply(outcome.reply.text);
      return;
    }
    runAiTask<{ reply: string }>("assistant-reply", replyRequest(state, [...before, question], outcome.understood, outcome.reply), localOnly)
      .then(({ output, log }) => {
        if (log.source !== "ai") return outcome.reply.text;
        updateReply(answer.id, { text: output.reply, source: "ai" }, role);
        return output.reply;
      })
      .catch(() => outcome.reply.text)
      .then(speakReply);
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
    if (currentRole() !== "owner" || replyOf(id)?.card?.kind !== "routine-offer") return;
    dispatch({ type: "card/dismiss", id: `routine-${routine.id}` });
    updateReply(id, { status: "declined" });
  };

  /** Ends the conversation. Nothing from it is kept: the assistant remembers only what the owner asks it to. */
  const newConversation = () => void startNewThread();

  return { thread, aiReady, examples, role, send, approve, decline, undoReply, edit: editReply, pick, remember, keepRoutine, skipRoutine, newConversation };
}
