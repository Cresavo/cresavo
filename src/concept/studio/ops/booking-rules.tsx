"use client";

import { useState } from "react";
import { majorString, minorDigits } from "../../connections/core";
import { quote, toMinor } from "../../booking/protection";
import { PolicySummary } from "../../booking/policy-summary";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Section, Card } from "../../ui/card";
import { Checkbox, Field, Select, TextInput } from "../../ui/controls";
import { showActionFailure } from "../../ui/toast";
import { dispatchWithUndoToast } from "../log/undo-toast";

export function BookingRules({ state }: { state: DemoState }) {
  const [draft, setDraft] = useState(state.cancellationPolicy);
  const [serviceId, setService] = useState(state.services[0]?.id);
  const service = state.services.find(s => s.id === serviceId);
  const currency = state.localization.currency;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.cancellationPolicy);
  const exempt = draft.exemptServices.includes(serviceId);
  return <Section title={t("protection.rules")}><Card className="p-4">
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (!dispatchWithUndoToast({ type: "salon/policy", policy: draft }, t("protection.saved"))) showActionFailure("protection.changed");
    }}>
      <p className="text-sm text-text-secondary">{t("protection.version", { version: state.cancellationPolicy.version })}</p>
      {(["freeHours", "latePercent", "noShowPercent"] as const).map(key =>
        <Field width="number" key={key} label={t(`protection.${key}`)}><TextInput type="number" required min="0" max={key === "freeHours" ? 8760 : 100}
          value={Number.isFinite(draft[key]) ? draft[key] : ""} onChange={e => setDraft({ ...draft, [key]: e.target.valueAsNumber })} /></Field>)}
      {state.services.length > 0 && <Field width="short" label={t("protection.treatment")}><Select value={serviceId} onChange={e => setService(e.target.value)}>
        {state.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select></Field>}
      {service && <>
        <Field width="number" label={t("protection.depositInput", { currency })}><TextInput key={serviceId} type="number" min="0" required
          step={10 ** -minorDigits(currency)} defaultValue={majorString({ amountMinor: draft.deposits[serviceId] ?? 0, currency })}
          onChange={e => setDraft({ ...draft, deposits: { ...draft.deposits, [serviceId]: toMinor(e.target.valueAsNumber, currency) } })} /></Field>
        <Checkbox label={t("protection.exempt")} checked={exempt} onChange={e => setDraft({ ...draft,
          exemptServices: e.target.checked ? [...draft.exemptServices, serviceId] : draft.exemptServices.filter(id => id !== serviceId),
        })} />
      </>}
      <Checkbox label={t("protection.newOnly")} checked={draft.newCustomersOnly} onChange={e => setDraft({ ...draft, newCustomersOnly: e.target.checked })} />
      {service && <div className="space-y-2 rounded-lg bg-surface-2 p-3">
        <h3 className="font-semibold">{t("protection.preview")}</h3>
        <PolicySummary terms={quote(draft, service, currency, true)} />
        {draft.newCustomersOnly && <p className="text-sm">{t("protection.returning")}</p>}
      </div>}
      <Button type="submit" width="responsive" disabled={!dirty}>{t("common.save")}</Button>
    </form>
  </Card></Section>;
}
