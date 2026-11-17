"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Mic, Sparkles } from "lucide-react";
import { runAiTask } from "../../ai/api-client";
import { useSpeech } from "../../command/use-speech";
import { addDays } from "../../data/dates";
import { openingFor } from "../../data/slots";
import type { Customer, DateKey, Salon } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextArea, TextInput } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { showToast } from "../../ui/toast";
import { NewBookingSheet, type NewBookingPreset } from "../booking/new-booking-sheet";
import { useStudio } from "../use-studio";
import { suggestedWeeks } from "../../customers/next-visit";

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

/** Dictate or type what happened, let the AI sort it into fields, edit, save. */
export function JournalDictation({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { state, today } = useStudio();
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<{ treatment: string; observations: string; advice: string; nextVisit: string; source: Source } | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<NewBookingPreset | null>(null);
  const speech = useSpeech({
    continuous: true,
    onText: (spoken) => setTranscript((current) => [current.trim(), spoken].filter(Boolean).join(" ")),
  });

  const structure = async () => {
    speech.stop();
    setBusy(true);
    try {
      const { output, log } = await runAiTask<Structured>("structure-journal", { transcript });
      setFields({ treatment: output.treatment, observations: output.observations, advice: output.recommendation, nextVisit: output.nextVisit, source: log.source });
    } catch {
      showToast(t("journal.structureFailed"));
    } finally {
      setBusy(false);
    }
  };

  const weeks = fields ? suggestedWeeks(fields.nextVisit) : undefined;

  const save = (thenBook: boolean) => {
    if (!fields) return;
    const { treatment, observations, advice, nextVisit } = fields;
    dispatch({
      type: "journal/add",
      entry: { customerId: customer.id, date: today, staffId: customer.preferredStaff, treatment, observations, advice, nextVisit: nextVisit.trim() || undefined },
    });
    showToast(t("journal.saved"), { label: t("common.undo"), run: undo });
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
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", fields.source === "ai" ? "bg-eko-accent-soft text-eko-accent" : "bg-eko-sunken text-eko-muted")}>
            {fields.source === "ai" && <Sparkles size={12} />}
            {fields.source === "ai" ? t("journal.source.ai") : t("journal.source.rules")}
          </span>
        )}
      </div>
      {!fields ? (
        <>
          <Field label={t("journal.transcript")} hint={speech.supported ? t("journal.transcriptHint") : t("journal.transcriptHintTyping")}>
            <TextArea
              value={speech.listening && speech.interim ? `${transcript} ${speech.interim}`.trim() : transcript}
              readOnly={speech.listening}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder={t("journal.transcriptPlaceholder")}
              className="min-h-32"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            {speech.supported && (
              <Button variant="secondary" icon={<Mic size={18} />} aria-pressed={speech.listening} onClick={speech.toggle} className={cx(speech.listening && "animate-pulse")}>
                {speech.listening ? t("journal.stopDictating") : t("journal.startDictating")}
              </Button>
            )}
            <Button disabled={!transcript.trim() || busy} icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} onClick={structure}>
              {t("journal.structure")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-eko-muted">{t("journal.reviewNote")}</p>
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
