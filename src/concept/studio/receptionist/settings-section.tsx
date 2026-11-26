"use client";

import { useState } from "react";
import type { DateKey, DemoState } from "../../data/types";
import { t } from "../../i18n";
import { receptionistSettings, wouldAnswer } from "../../receptionist/actions";
import { defaultGreeting } from "../../receptionist/instructions";
import { MAX_GREETING, type AnswerWhen } from "../../receptionist/types";
import { dispatch } from "../../store";
import { Card, Section } from "../../ui/card";
import { Field, Segmented, Switch, TextArea } from "../../ui/controls";
import { ListRow } from "../../ui/list-row";
import { showToast } from "../../ui/toast";

const RULES: readonly AnswerWhen[] = ["always", "open", "closed"];

/** On or off, what Maja says first, and when she answers. Each change is saved as it is made. */
export function SettingsSection({ state, today, minutes }: { state: DemoState; today: DateKey; minutes: number }) {
  const settings = receptionistSettings(state);
  const [draft, setDraft] = useState<string>();
  const saveGreeting = () => {
    if (draft === undefined) return;
    if (dispatch({ type: "receptionist/settings", settings: { greeting: draft } })) showToast(t("receptionist.greeting.saved"));
    setDraft(undefined);
  };
  const toggle = () => {
    if (dispatch({ type: "receptionist/settings", settings: { enabled: !settings.enabled } })) showToast(t(settings.enabled ? "receptionist.turnedOff" : "receptionist.turnedOn"));
  };

  return (
    <Section title={t("receptionist.settings.title")}>
      <Card className="overflow-hidden">
        <ListRow title={t("receptionist.enabled.label")} meta={t("receptionist.enabled.meta")}
          trailing={<Switch checked={settings.enabled} label={t("receptionist.enabled.label")} onChange={toggle} />} />
        <div className="space-y-5 px-4 pb-4 pt-2">
          <Field label={t("receptionist.greeting.label")} hint={t("receptionist.greeting.hint")}>
            <TextArea rows={3} maxLength={MAX_GREETING} value={draft ?? settings.greeting}
              placeholder={defaultGreeting(state.salon.name, state.localization.language)}
              onChange={(event) => setDraft(event.target.value)} onBlur={saveGreeting} />
          </Field>
          <div className="space-y-2">
            <p className="text-body font-medium">{t("receptionist.answerWhen.label")}</p>
            <Segmented<AnswerWhen> label={t("receptionist.answerWhen.label")} value={settings.answerWhen}
              options={RULES.map((value) => ({ value, label: t(`receptionist.answerWhen.${value}`) }))}
              onChange={(answerWhen) => dispatch({ type: "receptionist/settings", settings: { answerWhen } })} />
            <p className="text-meta text-text-secondary" aria-live="polite">
              {t(`receptionist.answerWhen.hint.${settings.answerWhen}`)}
              {settings.enabled && <> {t(wouldAnswer(state, today, minutes) ? "receptionist.answerWhen.now.yes" : "receptionist.answerWhen.now.no")}</>}
            </p>
          </div>
        </div>
      </Card>
    </Section>
  );
}
