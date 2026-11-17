"use client";

import { useSyncExternalStore } from "react";
import { emptyContext, type Message, type Reply, type ThreadContext } from "../../assistant/thread";

// The open conversation and whether the panel is showing, kept in the
// browser next to the demo store. A new day starts a new conversation.

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

let thread: ThreadState | null = null;
const listeners = new Set<() => void>();

function load(): ThreadState {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as ThreadState | null;
    if (saved?.day === today()) return { ...saved, open: false, listen: false };
    return fresh(saved?.speak);
  } catch {
    return fresh();
  }
}

function snapshot(): ThreadState {
  thread ??= load();
  return thread;
}

function update(patch: Partial<ThreadState>) {
  thread = { ...snapshot(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...thread, messages: thread.messages.slice(-MAX_MESSAGES) }));
  } catch {
    // The conversation then lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

const serverThread = fresh();

export function useThread(): ThreadState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot,
    () => serverThread,
  );
}

/** A question to send as soon as the panel is open, e.g. from a Today card. */
let pendingQuestion: string | null = null;

export function openAssistant(options: { listen?: boolean; ask?: string } = {}) {
  pendingQuestion = options.ask ?? null;
  update({ open: true, listen: !!options.listen });
}

export function closeAssistant() {
  update({ open: false, listen: false });
}

export function takePendingQuestion(): string | null {
  const question = pendingQuestion;
  pendingQuestion = null;
  return question;
}

export function addMessages(messages: Message[], context?: ThreadContext) {
  update({ messages: [...snapshot().messages, ...messages], listen: false, ...(context ? { context } : {}) });
}

/** Changes a reply after it was shown: AI wording arrived, or the owner approved or declined its card. */
export function updateReply(id: string, patch: Partial<Reply>) {
  update({ messages: snapshot().messages.map((m) => (m.id === id && m.reply ? { ...m, text: patch.text ?? m.text, reply: { ...m.reply, ...patch } } : m)) });
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
