"use client";

import { t, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { StatusDot } from "../../ui/feedback";
import type { ConversationControls } from "./use-conversation";

const PHASE: Record<"listening" | "thinking" | "speaking", MessageKey> = {
  listening: "assistant.voice.listening",
  thinking: "assistant.voice.thinking",
  speaking: "assistant.voice.speaking",
};

const ENDED: Record<NonNullable<ConversationControls["ended"]>, MessageKey> = {
  stopped: "assistant.voice.ended.stopped",
  silence: "assistant.voice.ended.silence",
  hidden: "assistant.voice.ended.hidden",
  failed: "assistant.voice.ended.failed",
};

/** What the spoken conversation is doing, said in words above the message box, with Stop while it runs. */
export function ConversationBar({ talk }: { talk: ConversationControls }) {
  if (talk.phase === "off") return null;
  const status = talk.phase === "ended" ? t(ENDED[talk.ended ?? "stopped"]) : t(PHASE[talk.phase]);
  return (
    <div className="flex min-h-target items-center justify-between gap-3 pb-2">
      <p role="status" className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
        {talk.active && <StatusDot className={talk.phase === "listening" ? "text-action" : undefined} />}
        <span className="min-w-0">{status}</span>
      </p>
      {talk.active && (
        <Button variant="secondary" size="sm" aria-label={t("assistant.voice.stopLabel")} onClick={talk.stop}>
          {t("assistant.voice.stop")}
        </Button>
      )}
    </div>
  );
}
