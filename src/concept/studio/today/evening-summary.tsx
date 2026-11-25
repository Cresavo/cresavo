"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Square, Volume2 } from "lucide-react";
import { t } from "../../i18n";
import { taskEnabled } from "../../modules/registry";
import { eveningRecap, eveningSpeech, summaryDue } from "../../summary/day";
import { Button } from "../../ui/button";
import { Section } from "../../ui/card";
import { canSpeak, speak, stopSpeaking } from "../assistant/speak";
import { useStudio } from "../use-studio";

const noSubscribe = () => () => undefined;

interface Recap {
  title: string;
  summary: string;
  highlights: string[];
}

interface ViewProps {
  recap: Recap;
  /** The browser can read aloud; without it the text stands alone. */
  speakable: boolean;
  speaking: boolean;
  onToggle: () => void;
}

/** The evening recap and its read-aloud button, without state: what the owner sees. */
export function EveningSummaryView({ recap, speakable, speaking, onToggle }: ViewProps) {
  const action = speakable && (
    <Button variant="tertiary" size="sm" icon={speaking ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />} onClick={onToggle} aria-pressed={speaking}>
      {t(speaking ? "brief.stopReading" : "brief.readAloud")}
    </Button>
  );
  return (
    <Section title={recap.title} action={action}>
      <div className="space-y-3" data-help="evening-summary" data-testid="evening-summary">
        <div className="flex items-start gap-3">
          <Moon size={18} aria-hidden className="mt-1 shrink-0 text-text-secondary" />
          <p className="min-w-0 flex-1 font-medium">{recap.summary}</p>
        </div>
        <ul className="space-y-1 pl-8 text-sm text-text-secondary">
          {recap.highlights.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </Section>
  );
}

/**
 * After the last booking: the day and tomorrow in a few lines, from rules only (no model, no cost).
 * A button reads them aloud with the browser's speech synthesis, and only ever when that button is pressed.
 */
export function EveningSummary() {
  const { state, today, minutes } = useStudio();
  const due = taskEnabled(state.modules, "daily-summary") && summaryDue(state, { today, minutes });
  const recap = useMemo(() => eveningRecap(state, { today, minutes }), [state, today, minutes]);
  const speakable = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  const [speaking, setSpeaking] = useState(false);
  const turn = useRef(0);

  const toggle = useCallback(() => {
    const mine = ++turn.current;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const started = speak(eveningSpeech(recap), () => {
      if (turn.current === mine) setSpeaking(false);
    });
    setSpeaking(started);
  }, [recap, speaking]);

  const speakingNow = useRef(false);
  useEffect(() => {
    speakingNow.current = speaking;
  }, [speaking]);
  useEffect(() => {
    if (due) return;
    if (!speakingNow.current) return;
    turn.current += 1;
    stopSpeaking();
    setSpeaking(false);
  }, [due]);
  useEffect(() => () => {
    if (speakingNow.current) stopSpeaking();
  }, []);

  if (!due) return null;
  return <EveningSummaryView recap={recap} speakable={speakable} speaking={speaking} onToggle={toggle} />;
}
