"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ListChecks, Loader2, Mic, Square, Upload } from "lucide-react";
import { runAiTask } from "../../ai/api-client";
import { useSpeech } from "../../command/use-speech";
import { addDays } from "../../data/dates";
import { probeDuration } from "../../journals/audio-duration";
import { AUDIO_ACCEPT, checkAudioFile } from "../../journals/audio-file";
import { audioScope, type JournalRecording } from "../../journals/audio-store";
import { currentTarget } from "../../store";
import { openingFor } from "../../data/slots";
import type { Customer, DateKey, Salon } from "../../data/types";
import { t } from "../../i18n";
import { Button, buttonClass } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextArea, TextInput } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { StatusDot } from "../../ui/feedback";
import { showToast } from "../../ui/toast";
import { NewBookingSheet, type NewBookingPreset } from "../booking/new-booking-sheet";
import { useStudio } from "../use-studio";
import { suggestedWeeks } from "../../customers/next-visit";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { formatClock, JournalRecordings, useRecordings } from "./journal-recordings";
import { useRecorder } from "./use-recorder";

interface Structured {
  treatment: string;
  observations: string;
  recommendation: string;
  nextVisit: string;
}

type Source = "ai" | "rules";

/** First day on or after the target date when the salon is open. */
function nextOpenDay(salon: Salon, date: DateKey): DateKey {
  let day = date;
  for (let i = 0; i < 7 && !openingFor(salon, day); i++) day = addDays(day, 1);
  return day;
}

/** Hint under the text: what this browser can do with the voice, or what an uploaded recording still needs. */
function transcriptHint(canRecord: boolean, canTranscribe: boolean, uploaded: boolean) {
  if (uploaded) return t("journal.audio.uploadHint");
  if (canRecord) return canTranscribe ? t("journal.audio.hint") : t("journal.audio.hintRecordOnly");
  return canTranscribe ? t("journal.transcriptHint") : t("journal.transcriptHintTyping");
}

/**
 * Dictate, record, upload or type what happened, let the AI sort the text into fields, edit, save. Recordings stay in
 * this browser (`journals/audio-store`); only the text is ever structured.
 */
export function JournalDictation({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { state, today } = useStudio();
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<{ treatment: string; observations: string; advice: string; nextVisit: string; source: Source } | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<NewBookingPreset | null>(null);
  const [current, setCurrent] = useState<Pick<JournalRecording, "id" | "source">>();
  const text = useRef(transcript);
  useEffect(() => {
    text.current = transcript;
  });
  const scope = audioScope(currentTarget() ?? { workspace: "demo", epoch: "legacy" });
  const { recordings, add, setTranscript: keepTranscript } = useRecordings(customer.id, scope);
  const speech = useSpeech({
    continuous: true,
    onText: (spoken) => setTranscript((current) => {
      const next = [current.trim(), spoken].filter(Boolean).join(" ");
      text.current = next;
      return next;
    }),
  });

  const keep = async (audio: Blob, source: JournalRecording["source"], mime: string, seconds: number) => {
    const id = crypto.randomUUID();
    try {
      const dropped = await add({ id, customerId: customer.id, scope, createdAt: Date.now(), source, mime, seconds, transcript: source === "recorded" ? text.current.trim() || undefined : undefined, bytes: await audio.arrayBuffer() });
      setCurrent({ id, source });
      if (dropped.length) showToast(t("journal.audio.oldestDropped"));
      return id;
    } catch {
      showToast(t("journal.audio.saveFailed"));
      return undefined;
    }
  };

  const recorder = useRecorder({
    onEnd: speech.stop,
    onRecorded: (audio, seconds) => keep(audio, "recorded", audio.type, seconds),
  });

  const record = async () => {
    if (recorder.recording) return recorder.stop();
    if (!recorder.supported) return speech.toggle();
    if (await recorder.start()) speech.start();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const check = await checkAudioFile(file, probeDuration);
    if (!check.ok) return showToast(t(`journal.audio.rejected.${check.reason}`));
    await keep(file, "uploaded", check.mime, check.seconds);
  };

  const use = (recording: JournalRecording) => {
    setTranscript(recording.transcript ?? "");
    setCurrent({ id: recording.id, source: recording.source });
  };

  const structure = async () => {
    const recordedId = await recorder.stop();
    await speech.stop();
    const spoken = text.current.trim() || [transcript.trim(), speech.interim].filter(Boolean).join(" ");
    if (spoken !== transcript) setTranscript(spoken);
    setBusy(true);
    const id = recordedId ?? current?.id;
    if (id) void keepTranscript(id, spoken).catch(() => {});
    try {
      const { output, log } = await runAiTask<Structured>("structure-journal", { transcript: spoken }, !!state.industry);
      setFields({ treatment: output.treatment, observations: output.observations, advice: output.recommendation, nextVisit: output.nextVisit, source: log.source });
    } catch {
      showToast(t("journal.structureFailed"));
    } finally {
      setBusy(false);
    }
  };

  const weeks = fields ? suggestedWeeks(fields.nextVisit) : undefined;
  const listening = recorder.recording || speech.listening;

  const save = (thenBook: boolean) => {
    if (!fields) return;
    const { treatment, observations, advice, nextVisit } = fields;
    dispatchWithUndoToast({
      type: "journal/add",
      entry: { customerId: customer.id, date: today, staffId: customer.preferredStaff, treatment, observations, advice, nextVisit: nextVisit.trim() || undefined },
    }, t("journal.saved"));
    if (thenBook && weeks) {
      const lastService = state.bookings.filter((b) => b.customerId === customer.id && b.status === "completed").at(-1)?.serviceId;
      setBooking({ customerId: customer.id, serviceId: lastService, date: nextOpenDay(state.salon, addDays(today, weeks * 7)) });
    } else {
      onClose();
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <p className="font-semibold">{t("journal.dictate")}</p>
        {fields && (
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", fields.source === "ai" ? "bg-action-bg text-text" : "bg-surface-2 text-text-secondary")}>
            {fields.source === "ai" ? t("journal.source.ai") : t("journal.source.rules")}
          </span>
        )}
      </div>
      {!fields ? (
        <>
          <Field label={t("journal.transcript")} hint={transcriptHint(recorder.supported, speech.supported, current?.source === "uploaded")}>
            <TextArea
              value={speech.listening && speech.interim ? `${transcript} ${speech.interim}`.trim() : transcript}
              readOnly={speech.listening}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder={t("journal.transcriptPlaceholder")}
              className="min-h-32"
            />
          </Field>
          {listening && (
            <p role="status" className="flex items-center gap-2 text-meta text-text-secondary">
              <StatusDot kind="progress" />
              {recorder.recording ? t("journal.audio.recording") : t("journal.audio.listening")}
              {recorder.recording && <span aria-hidden="true" className="tabular-nums">{formatClock(recorder.seconds)}</span>}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <label className={cx(buttonClass("tertiary"), "cursor-pointer gap-2 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2", recorder.recording && "pointer-events-none opacity-50")}>
              <Upload size={18} aria-hidden />
              {t("journal.audio.upload")}
              <TextInput type="file" accept={AUDIO_ACCEPT} className="sr-only" disabled={recorder.recording}
                onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
            </label>
            {(recorder.supported || speech.supported) && (
              <Button variant="secondary" icon={listening ? <Square size={16} /> : <Mic size={18} />} aria-pressed={listening} onClick={() => void record()}>
                {listening ? t(recorder.supported ? "journal.audio.stop" : "journal.stopDictating") : t(recorder.supported ? "journal.audio.record" : "journal.startDictating")}
              </Button>
            )}
            <Button disabled={!transcript.trim() || busy} icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ListChecks size={18} />} onClick={structure}>
              {t("journal.structure")}
            </Button>
          </div>
          <JournalRecordings recordings={recordings} currentId={current?.id} onUse={use} />
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary">{t("journal.reviewNote")}</p>
          <Field label={t("journal.treatment")}>
            <TextInput value={fields.treatment} onChange={(e) => setFields({ ...fields, treatment: e.target.value })} />
          </Field>
          <Field label={t("journal.observations")}>
            <TextArea value={fields.observations} onChange={(e) => setFields({ ...fields, observations: e.target.value })} />
          </Field>
          <Field label={t("journal.advice")}>
            <TextArea value={fields.advice} onChange={(e) => setFields({ ...fields, advice: e.target.value })} />
          </Field>
          <Field label={t("journal.nextVisit")}>
            <TextInput value={fields.nextVisit} onChange={(e) => setFields({ ...fields, nextVisit: e.target.value })} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setFields(null)}>{t("common.back")}</Button>
            <Button variant={weeks ? "secondary" : "primary"} disabled={!fields.treatment.trim()} onClick={() => save(false)}>{t("common.save")}</Button>
            {weeks && (
              <Button disabled={!fields.treatment.trim()} icon={<CalendarPlus size={18} />} onClick={() => save(true)}>
                {t("journal.saveAndBook", { weeks })}
              </Button>
            )}
          </div>
        </>
      )}
      {booking && <NewBookingSheet preset={booking} onClose={onClose} />}
    </Card>
  );
}
