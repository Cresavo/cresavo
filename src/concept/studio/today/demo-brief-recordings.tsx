"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { briefSpeech } from "../../assistant/briefs";
import { t } from "../../i18n";
import { dayBookings } from "../../selectors";
import { eveningRecap, eveningSpeech } from "../../summary/day";
import { Button } from "../../ui/button";
import { Section } from "../../ui/card";
import {
  eveningBriefClipUrl,
  morningBriefClipUrl,
  standardDemoMorningBrief,
} from "../assistant/demo-brief-audio";
import { canPlaySpeech, speak, stopSpeaking } from "../assistant/speak";
import { useStudio } from "../use-studio";

const noSubscribe = () => () => undefined;

/**
 * On the unedited standard Salong Eko demo, a separate pair of buttons plays the
 * recorded Elin readings in the Studio language at any time of day. The live
 * morning brief and evening summary stay on their own cards and keep today's facts.
 */
export function DemoBriefRecordings() {
  const { state, today, minutes } = useStudio();
  const readings = useMemo(() => {
    const morning = standardDemoMorningBrief(state, today, state.generatedFor, minutes);
    const lastEnd = Math.max(0, ...dayBookings(state, today).map((booking) => booking.start + booking.duration));
    const evening = eveningRecap(state, { today, minutes: Math.max(minutes, lastEnd) });
    return {
      morningClip: morning ? morningBriefClipUrl(morning, { today, minutes: 9 * 60 }, state.generatedFor) : null,
      eveningClip: eveningBriefClipUrl(evening, { today }, state.generatedFor),
      morningText: morning ? briefSpeech({ ...morning, title: t("brief.morning") }) : "",
      eveningText: eveningSpeech(evening),
    };
  }, [state, today, minutes]);
  const speakable = useSyncExternalStore(
    noSubscribe,
    () => canPlaySpeech(readings.morningClip ?? readings.eveningClip),
    () => false,
  );
  const [playing, setPlaying] = useState<"morning" | "evening" | null>(null);
  const turn = useRef(0);
  const playingNow = useRef<"morning" | "evening" | null>(null);
  useEffect(() => {
    playingNow.current = playing;
  }, [playing]);
  useEffect(() => {
    const available = playing === "morning" ? readings.morningClip : playing === "evening" ? readings.eveningClip : true;
    if (available || !playingNow.current) return;
    turn.current += 1;
    stopSpeaking();
    setPlaying(null);
  }, [playing, readings.morningClip, readings.eveningClip]);
  useEffect(() => () => {
    if (playingNow.current) stopSpeaking();
  }, []);

  const toggle = useCallback((which: "morning" | "evening", clip: string, text: string) => {
    const mine = ++turn.current;
    if (playing === which) {
      stopSpeaking();
      setPlaying(null);
      return;
    }
    const started = speak(text, () => {
      if (turn.current === mine) setPlaying(null);
    }, clip);
    setPlaying(started ? which : null);
  }, [playing]);

  if (!speakable || (!readings.morningClip && !readings.eveningClip)) return null;
  return (
    <Section title={t("brief.recordedTitle")}>
      <p className="mb-3 text-sm text-text-secondary">{t("brief.recordedHint")}</p>
      <div className="flex flex-wrap gap-2">
        {readings.morningClip && (
          <Button
            variant="tertiary"
            size="sm"
            icon={playing === "morning" ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
            onClick={() => toggle("morning", readings.morningClip!, readings.morningText)}
            aria-pressed={playing === "morning"}
          >
            {t(playing === "morning" ? "brief.stopReading" : "brief.recordedMorning")}
          </Button>
        )}
        {readings.eveningClip && (
          <Button
            variant="tertiary"
            size="sm"
            icon={playing === "evening" ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
            onClick={() => toggle("evening", readings.eveningClip!, readings.eveningText)}
            aria-pressed={playing === "evening"}
          >
            {t(playing === "evening" ? "brief.stopReading" : "brief.recordedEvening")}
          </Button>
        )}
      </div>
    </Section>
  );
}
