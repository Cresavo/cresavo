"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { journalAudioStore, type JournalRecording } from "../../journals/audio-store";
import { locale, t } from "../../i18n";
import { onSalonRemoved } from "../../store";
import { Button } from "../../ui/button";

let watchingSalons = false;
function watchSalonRemoval() {
  if (watchingSalons || typeof window === "undefined") return;
  watchingSalons = true;
  onSalonRemoved((workspace) => {
    void journalAudioStore().removeWorkspace(workspace).catch(() => {});
  });
}

/** A customer's kept recordings (newest first) and the calls that change them. */
export function useRecordings(customerId: string, scope: string) {
  const [recordings, setRecordings] = useState<JournalRecording[]>([]);
  const refresh = useCallback(async () => {
    const next = await journalAudioStore().list(customerId, scope).catch(() => []);
    setRecordings(next);
  }, [customerId, scope]);
  useEffect(() => {
    watchSalonRemoval();
    let live = true;
    journalAudioStore().list(customerId, scope).then((next) => live && setRecordings(next), () => {});
    return () => {
      live = false;
    };
  }, [customerId, scope]);
  /** Keeps a recording; resolves with the ids of older ones it pushed out of the last five. */
  const add = useCallback(async (recording: JournalRecording) => {
    const dropped = await journalAudioStore().add(recording);
    await refresh();
    return dropped;
  }, [refresh]);
  const setTranscript = useCallback(async (id: string, transcript: string) => {
    await journalAudioStore().setTranscript(id, transcript);
    await refresh();
  }, [refresh]);
  return { recordings, add, setTranscript };
}

/** A length as m:ss, as a recorder shows it. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function Recording({ recording, current, onUse }: { recording: JournalRecording; current: boolean; onUse: (recording: JournalRecording) => void }) {
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(recording.createdAt);
  const title = t(recording.source === "uploaded" ? "journal.audio.uploaded" : "journal.audio.recorded", { when });
  const audio = useMemo(() => new Blob([recording.bytes], { type: recording.mime }), [recording.bytes, recording.mime]);
  // The object URL lives exactly as long as the element that plays it.
  const player = useCallback((element: HTMLAudioElement | null) => {
    if (!element) return;
    const url = URL.createObjectURL(audio);
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  return (
    <li className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-x-2 text-body">
        <span className="font-medium">{title}</span>
        <span className="text-meta text-text-secondary">{formatClock(recording.seconds)}</span>
        {current && <span className="text-meta text-text-secondary">{t("journal.audio.current")}</span>}
      </p>
      <audio ref={player} controls preload="metadata" aria-label={title} className="h-10 w-full" />
      {recording.transcript && !current && (
        <Button variant="link" size="sm" onClick={() => onUse(recording)}>{t("journal.audio.useTranscript")}</Button>
      )}
    </li>
  );
}

/** The last recordings of this customer, playable here; one with a transcript can fill the text again. */
export function JournalRecordings({ recordings, currentId, onUse }: { recordings: JournalRecording[]; currentId?: string; onUse: (recording: JournalRecording) => void }) {
  const heading = useId();
  if (!recordings.length) return null;
  return (
    <section aria-labelledby={heading} className="space-y-3">
      <h3 id={heading} className="text-meta font-semibold text-text-secondary">{t("journal.audio.recent")}</h3>
      <ul className="space-y-4">
        {recordings.map((recording) => <Recording key={recording.id} recording={recording} current={recording.id === currentId} onUse={onUse} />)}
      </ul>
    </section>
  );
}
