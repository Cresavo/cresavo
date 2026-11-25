"use client";

import { useState } from "react";
import { majorString, minorDigits } from "../../connections/core";
import { paysAtSalon, quote, toMinor, type CancellationPolicy } from "../../booking/protection";
import { PolicySummary } from "../../booking/policy-summary";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Section, Card } from "../../ui/card";
import { Checkbox, Field, Select, Switch, TextInput } from "../../ui/controls";
import { showActionFailure } from "../../ui/toast";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** A label with a short line under it and a switch at the end of the row. */
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: () => void }) {
  return <div className="flex items-center justify-between gap-3">
    <span className="min-w-0">
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-text-secondary">{hint}</span>
    </span>
    <Switch checked={checked} onChange={onChange} label={label} />
  </div>;
}

const without = <T,>(record: Record<string, T>, id: string) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

/** The treatment's own choice; a choice equal to the salon's is dropped so the treatment follows the salon again. */
function choosePayAtSalon(draft: CancellationPolicy, serviceId: string, on: boolean): CancellationPolicy {
  return { ...draft, payAtSalon: on === draft.payAtSalonDefault ? without(draft.payAtSalon, serviceId) : { ...draft.payAtSalon, [serviceId]: on } };
}

export function BookingRules({ state }: { state: DemoState }) {
  const [draft, setDraft] = useState(state.cancellationPolicy);
  const [serviceId, setService] = useState(state.services[0]?.id);
  const service = state.services.find(s => s.id === serviceId);
  const currency = state.localization.currency;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.cancellationPolicy);
  const exempt = draft.exemptServices.includes(serviceId);
  const atSalon = !!service && paysAtSalon(draft, service.id);
  const priceMinor = service ? toMinor(service.price, currency) : 0;
  const setDeposit = (amount: number) => setDraft({
    ...draft, deposits: Number.isFinite(amount) && toMinor(amount, currency) < priceMinor ? { ...draft.deposits, [serviceId]: toMinor(amount, currency) } : without(draft.deposits, serviceId),
  });
  return <Section title={t("protection.rules")}><Card className="p-4">
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (!dispatchWithUndoToast({ type: "salon/policy", policy: draft }, t("protection.saved"))) showActionFailure("protection.changed");
    }}>
      <p className="text-sm text-text-secondary">{t("protection.version", { version: state.cancellationPolicy.version })}</p>
      <SwitchRow label={t("protection.payAtSalon")} hint={t(draft.payAtSalonDefault ? "protection.payAtSalonOn" : "protection.payAtSalonOff")}
        checked={draft.payAtSalonDefault} onChange={() => setDraft({ ...draft, payAtSalonDefault: !draft.payAtSalonDefault })} />
      {(["freeHours", "latePercent", "noShowPercent"] as const).map(key =>
        <Field width="number" key={key} label={t(`protection.${key}`)}><TextInput type="number" required min="0" max={key === "freeHours" ? 8760 : 100}
          value={Number.isFinite(draft[key]) ? draft[key] : ""} onChange={e => setDraft({ ...draft, [key]: e.target.valueAsNumber })} /></Field>)}
      {state.services.length > 0 && <Field width="short" label={t("protection.treatment")}><Select value={serviceId} onChange={e => setService(e.target.value)}>
        {state.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select></Field>}
      {service && <>
        <SwitchRow label={t("protection.payAtSalonFor", { service: service.name })} hint={t(!Object.hasOwn(draft.payAtSalon, service.id) ? "protection.payAtSalonSame" : atSalon ? "protection.payAtSalonOn" : "protection.payAtSalonOff")}
          checked={atSalon} onChange={() => setDraft(choosePayAtSalon(draft, service.id, !atSalon))} />
        {!atSalon && !exempt && <details className="group border-t border-hairline pt-2" open={Object.hasOwn(draft.deposits, serviceId) || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("protection.smallerDeposit")}
            <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="pb-1 pt-2">
            <Field width="number" label={t("protection.depositInput", { currency })} hint={t("protection.depositHint")}>
              <TextInput key={serviceId} type="number" min="0" step={10 ** -minorDigits(currency)}
                defaultValue={majorString({ amountMinor: Math.min(priceMinor, draft.deposits[serviceId] ?? priceMinor), currency })}
                onChange={e => setDeposit(e.target.valueAsNumber)} />
            </Field>
          </div>
        </details>}
        <Checkbox label={t("protection.exempt")} checked={exempt} onChange={e => setDraft({ ...draft,
          exemptServices: e.target.checked ? [...draft.exemptServices, serviceId] : draft.exemptServices.filter(id => id !== serviceId),
        })} />
      </>}
      <Checkbox label={t("protection.newOnly")} checked={draft.newCustomersOnly} onChange={e => setDraft({ ...draft, newCustomersOnly: e.target.checked })} />
      {service && <div className="space-y-2 rounded-lg bg-surface-2 p-3">
        <h3 className="font-semibold">{t("protection.preview")}</h3>
        <PolicySummary terms={quote(draft, service, currency, true)} />
        {draft.newCustomersOnly && !atSalon && !exempt && <p className="text-sm">{t("protection.returning")}</p>}
      </div>}
      <Button type="submit" width="responsive" disabled={!dirty}>{t("common.save")}</Button>
    </form>
  </Card></Section>;
}
