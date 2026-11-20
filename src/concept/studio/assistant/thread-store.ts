"use client";

import { useSyncExternalStore } from "react";
import { emptyContext, type Message, type Reply, type ThreadContext } from "../../assistant/thread";
import type { Role } from "../../ops/access";
import { currentState } from "../../store";
import { currentRole } from "../../ops/role";

// Each role's conversation and panel state live in the browser next to the
// demo store. A new day starts a new conversation.

const STORAGE_KEY = "salong-eko-assistant";
const MAX_MESSAGES = 60;

interface ThreadState {
  day: string;
  messages: Message[];
  context: ThreadContext;
  open: boolean;
  /** The panel was opened with the microphone: start listening at once. */
  listen: boolean;
  /** Read replies aloud with the browser's speech synthesis. */
  speak: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const fresh = (speak = false): ThreadState => ({ day: today(), messages: [], context: emptyContext(), open: false, listen: false, speak });

const threads: Record<string, ThreadState> = {};
const listeners = new Set<() => void>();

function storageKey(role: Role) {
  const base = currentState()?.industry ? `${STORAGE_KEY}-own` : STORAGE_KEY;
  return role === "owner" ? base : `${base}-staff`;
}

/** Which conversation: a role's, in the salon shown now. An async save captures it first, so its outcome lands there. */
export function threadKey(role = currentRole()): string {
  return storageKey(role);
}

function load(key: string): ThreadState {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as ThreadState | null;
    // A save that was running when the page went away has no outcome to wait for: its card is actionable again.
    if (saved?.day === today()) return { ...saved, open: false, listen: false, messages: saved.messages.map((m) => (m.reply?.pending ? { ...m, reply: { ...m.reply, pending: undefined } } : m)) };
    return fresh(saved?.speak);
  } catch {
    return fresh();
  }
}

function snapshotAt(key: string): ThreadState {
  return threads[key] ??= load(key);
}

function snapshot(role = currentRole()): ThreadState {
  return snapshotAt(storageKey(role));
}

function updateAt(key: string, patch: Partial<ThreadState>) {
  const thread = threads[key] = { ...snapshotAt(key), ...patch };
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...thread, messages: thread.messages.slice(-MAX_MESSAGES) }));
  } catch {
    // The conversation then lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function update(patch: Partial<ThreadState>, role = currentRole()) {
  updateAt(storageKey(role), patch);
}

const serverThread = fresh();

export function useThread(role: Role): ThreadState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot(role),
    () => serverThread,
  );
}

/** A question to send as soon as the panel is open, e.g. from a Today card. */
const pendingQuestions: Partial<Record<Role, string>> = {};

export function openAssistant(options: { listen?: boolean; ask?: string } = {}) {
  const role = currentRole();
  if (options.ask) pendingQuestions[role] = options.ask;
  else delete pendingQuestions[role];
  update({ open: true, listen: !!options.listen });
}

export function closeAssistant() {
  update({ open: false, listen: false });
}

export function takePendingQuestion(): string | null {
  const role = currentRole();
  const question = pendingQuestions[role];
  delete pendingQuestions[role];
  return question ?? null;
}

export function addMessages(messages: Message[], context?: ThreadContext, role = currentRole()) {
  update({ messages: [...snapshot(role).messages, ...messages], listen: false, ...(context ? { context } : {}) }, role);
}

/**
 * A better reading arrived (the AI's). It replaces the reply, and its context replaces the
 * conversation's, together and only while the refinement is still pending: the owner has not
 * picked, approved, declined or edited, and has not moved on to another message. Otherwise it is
 * dropped, so the card on screen and what "that day" means never disagree. Returns whether it applied.
 */
export function refineReply(id: string, patch: Partial<Reply>, context?: ThreadContext, role = currentRole()): boolean {
  const { messages } = snapshot(role);
  const message = messages.find((m) => m.id === id);
  const current = messages[messages.length - 1]?.id === id;
  // A reply whose change is being saved keeps the proposal that is being saved.
  if (!message?.reply?.refining || message.reply.status || message.reply.pending || !current) {
    if (message?.reply?.refining) updateReply(id, {}, role);
    return false;
  }
  update({
    messages: messages.map((m) => (m.id === id && m.reply ? { ...m, text: patch.text ?? m.text, reply: { ...m.reply, ...patch, refining: undefined } } : m)),
    ...(context ? { context } : {}),
  }, role);
  return true;
}

/** Changes a reply in the conversation `key` (see `threadKey`). Any pending refinement is discarded. */
export function updateReplyIn(key: string, id: string, patch: Partial<Reply>) {
  const { messages } = snapshotAt(key);
  if (!messages.some((message) => message.id === id && message.reply)) return;
  updateAt(key, { messages: messages.map((m) => (m.id === id && m.reply ? { ...m, text: patch.text ?? m.text, reply: { ...m.reply, refining: undefined, ...patch } } : m)) });
}

/** Changes a reply after it was shown: AI wording arrived, or the owner acted on its card. Any pending refinement is discarded. */
export function updateReply(id: string, patch: Partial<Reply>, role = currentRole()) {
  updateReplyIn(storageKey(role), id, patch);
}

/** A reply in the conversation `key`. */
export function replyIn(key: string, id: string): Reply | undefined {
  return snapshotAt(key).messages.find((m) => m.id === id)?.reply;
}

/** A reply in the open conversation. */
export function replyOf(id: string): Reply | undefined {
  return replyIn(storageKey(currentRole()), id);
}

/** Clears the conversation and returns the one that ended, so it can be summarised. */
export function startNewThread(): Message[] {
  const ended = snapshot().messages;
  update({ messages: [], context: emptyContext() });
  return ended;
}

export function setSpeak(speak: boolean) {
  update({ speak });
}

let counter = 0;
export const messageId = () => `msg-${Date.now()}-${counter++}`;
