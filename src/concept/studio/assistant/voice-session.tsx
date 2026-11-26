"use client";

import { useEffect, type ReactNode } from "react";
import type { InputMode, Reply } from "../../assistant/thread";
import type { TalkControls } from "./talk-controls";
import { useConversation } from "./use-conversation";

type Send = (text: string, via: InputMode, talk: (reply: Reply | null) => void) => void;

/** Mounts the spoken conversation only when the Labs switch is on. */
export default function VoiceSession({
  send,
  assistantOn,
  open,
  role,
  children,
}: {
  send: Send;
  assistantOn: boolean;
  open: boolean;
  role: string;
  children: (talk: TalkControls) => ReactNode;
}) {
  const talk = useConversation(send, assistantOn);
  const { close } = talk;
  useEffect(() => {
    if (!open) close();
  }, [open, close]);
  useEffect(() => close, [role, close]);
  return <>{children(talk)}</>;
}
