"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Square, Volume2 } from "lucide-react";
import { t } from "../../i18n";
import { taskEnabled } from "../../modules/registry";
import { dayBookings } from "../../selectors";
import { eveningRecap, eveningSpeech, summaryDue } from "../../summary/day";
import { Button } from "../../ui/button";
import { Section } from "../../ui/card";
import { eveningBriefClipUrl } from "../assistant/demo-brief-audio";
import { canPlaySpeech, speak, stopSpeaking } from "../assistant/speak";
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
 * A button reads them aloud: a static Elin clip on the standard Salong Eko demo, in the Studio language, when the on-screen facts still match the recording, otherwise the browser's speech synthesis, and only ever when that button is pressed.
 * On that unedited demo a clearly labelled closing preview is also shown before the last booking ends, so the evening recording can be heard on the same visit.
 */
export function EveningSummary() {
  const { state, today, minutes } = useStudio();
  const summaryOn = taskEnabled(state.modules, "daily-summary");
  const due = summaryOn && summaryDue(state, { today, minutes });
  const recap = useMemo(() => {
    const lastEnd = Math.max(0, ...dayBookings(state, today).map((booking) => booking.start + booking.duration));
    // Before closing, use the end-of-day figures so the recorded evening reading can still match.
    return eveningRecap(state, { today, minutes: Math.max(minutes, lastEnd) });
  }, [state, today, minutes]);
  const clip = eveningBriefClipUrl(recap, { today }, state.generatedFor);
  const shown = useMemo(
    () => (!due && clip ? { ...recap, title: t("summary.demoPreviewTitle") } : recap),
    [due, clip, recap],
  );
  const speakable = useSyncExternalStore(noSubscribe, () => canPlaySpeech(clip), () => false);
  const [speaking, setSpeaking] = useState(false);
  const turn = useRef(0);

  const toggle = useCallback(() => {
    const mine = ++turn.current;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const started = speak(eveningSpeech(shown), () => {
      if (turn.current === mine) setSpeaking(false);
    }, clip);
    setSpeaking(started);
  }, [shown, clip, speaking]);

  const speakingNow = useRef(false);
  useEffect(() => {
    speakingNow.current = speaking;
  }, [speaking]);
  useEffect(() => {
    if ((summaryOn && (due || clip)) || !speakingNow.current) return;
    turn.current += 1;
    stopSpeaking();
    setSpeaking(false);
  }, [summaryOn, due, clip]);
  useEffect(() => () => {
    if (speakingNow.current) stopSpeaking();
  }, []);

  if (!summaryOn || (!due && !clip)) return null;
  return <EveningSummaryView recap={shown} speakable={speakable} speaking={speaking} onToggle={toggle} />;
}
