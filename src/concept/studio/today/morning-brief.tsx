"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { briefSpeech, morningBrief, type Brief } from "../../assistant/briefs";
import { t } from "../../i18n";
import { taskEnabled } from "../../modules/registry";
import { summaryDue } from "../../summary/day";
import { Button } from "../../ui/button";
import { Section } from "../../ui/card";
import { BriefList } from "../assistant/brief-list";
import { morningBriefClipUrl, standardDemoMorningBrief } from "../assistant/demo-brief-audio";
import { canPlaySpeech, speak, stopSpeaking } from "../assistant/speak";
import { useStudio } from "../use-studio";

const noSubscribe = () => () => undefined;

interface ViewProps {
  brief: Brief;
  /** The browser can read aloud; without it the text stands alone. */
  speakable: boolean;
  speaking: boolean;
  onToggle: () => void;
  className?: string;
}

/** The brief and its read-aloud button, without state: what the owner sees. */
export function MorningBriefView({ brief, speakable, speaking, onToggle, className }: ViewProps) {
  const action = speakable && (
    <Button variant="tertiary" size="sm" icon={speaking ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />} onClick={onToggle} aria-pressed={speaking}>
      {t(speaking ? "brief.stopReading" : "brief.readAloud")}
    </Button>
  );
  return (
    <Section title={brief.title} action={action} className={className}>
      <div data-testid="morning-brief" data-help="morning-brief">
        <BriefList brief={brief} />
      </div>
    </Section>
  );
}

/**
 * The day at a glance for the owner: rules pick and phrase the items from the salon's own data (no model, no cost),
 * and a button reads them aloud. On the standard Salong Eko demo, when the on-screen facts still match the recording, it plays a static Elin clip in the Studio language (English or Swedish); otherwise it uses the browser's speech synthesis. It only ever speaks when that button is pressed.
 * The card always shows the live brief. On the unedited demo the morning recording still plays later in the day if only time-sensitive lines have changed, and the card stays if that recording is still available after closing.
 */
export function MorningBrief({ className }: { className?: string }) {
  const { state, today, minutes } = useStudio();
  const brief = useMemo(() => {
    const rules = morningBrief(state, { today, minutes });
    return { ...rules, title: t(minutes < 12 * 60 ? "brief.morning" : "brief.day") };
  }, [state, today, minutes]);
  const recorded = standardDemoMorningBrief(state, today, state.generatedFor, minutes);
  const clip = recorded
    ? morningBriefClipUrl(recorded, { today, minutes: 9 * 60 }, state.generatedFor)
    : morningBriefClipUrl(brief, { today, minutes }, state.generatedFor);
  const speakable = useSyncExternalStore(noSubscribe, () => canPlaySpeech(clip), () => false);
  const [speaking, setSpeaking] = useState(false);
  // The utterance this card started, so a stale end from an earlier one does not reset the button.
  const turn = useRef(0);

  const toggle = useCallback(() => {
    const mine = ++turn.current;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const started = speak(briefSpeech(brief), () => {
      if (turn.current === mine) setSpeaking(false);
    }, clip);
    setSpeaking(started);
  }, [brief, clip, speaking]);

  // Leaving Today, or the evening summary taking over, stops this card's reading; it never starts one.
  const speakingNow = useRef(false);
  useEffect(() => {
    speakingNow.current = speaking;
  }, [speaking]);
  // Step aside only when the evening summary will actually take its place.
  const due = summaryDue(state, { today, minutes }) && taskEnabled(state.modules, "daily-summary") && state.bookings.some((booking) => !booking.example);
  useEffect(() => {
    if (!due || clip || !speakingNow.current) return;
    turn.current += 1;
    stopSpeaking();
    setSpeaking(false);
  }, [due, clip]);
  useEffect(() => () => {
    if (speakingNow.current) stopSpeaking();
  }, []);

  if (due && !clip) return null;
  return <MorningBriefView brief={brief} speakable={speakable} speaking={speaking} onToggle={toggle} className={className} />;
}
