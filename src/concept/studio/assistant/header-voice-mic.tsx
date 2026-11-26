"use client";

import { Mic } from "lucide-react";
import { useSpeechSupported } from "../../command/use-speech";
import { t } from "../../i18n";
import { IconButton } from "../../ui/button";
import { openAssistant } from "./thread-store";

/** Header microphone, loaded only when the Labs switch is on. */
export default function HeaderVoiceMic() {
  const canListen = useSpeechSupported();
  if (!canListen) return null;
  return (
    <IconButton label={t("assistant.voice.start")} onClick={() => openAssistant({ listen: true })} className="max-sm:hidden">
      <Mic size={16} aria-hidden />
    </IconButton>
  );
}
