"use client";

import { Mic } from "lucide-react";
import { t } from "../i18n";
import { cx } from "../ui/cx";
import { useSpeech } from "./use-speech";
import { sendVoiceCommand } from "./voice-command";

/** Phone-only microphone above the tab bar: speak a command from any studio page. */
export function FloatingMic() {
  const { supported, listening, interim, toggle } = useSpeech({ onText: sendVoiceCommand });
  if (!supported) return null;
  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex flex-col items-end gap-2 lg:hidden">
      {listening && <p className="max-w-[16rem] rounded-2xl bg-eko-ink px-3.5 py-2 text-sm text-eko-bg shadow-sheet">{interim || t("command.listening")}</p>}
      <button
        type="button"
        aria-label={t("command.voice")}
        aria-pressed={listening}
        onClick={toggle}
        className={cx(
          "flex size-14 items-center justify-center rounded-full bg-eko-accent text-eko-on-accent shadow-sheet",
          listening && "animate-pulse ring-4 ring-eko-accent/30",
        )}
      >
        <Mic size={24} />
      </button>
    </div>
  );
}
