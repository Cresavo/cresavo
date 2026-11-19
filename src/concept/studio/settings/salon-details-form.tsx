"use client";

import { useState, type FormEvent } from "react";
import { t } from "../../i18n";
import { checkSalonDetails, SALON_DETAIL_FIELDS, type SalonDetailField, type SalonDetails } from "../../ops/salon-details";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { useStudio } from "../use-studio";

const INPUT: Record<SalonDetailField, { type?: string; inputMode?: "tel" | "email"; autoComplete: string }> = {
  name: { autoComplete: "organization" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  email: { type: "email", inputMode: "email", autoComplete: "email" },
  address: { autoComplete: "street-address" },
  area: { autoComplete: "address-level2" },
};

const pick = (details: SalonDetails) => Object.fromEntries(SALON_DETAIL_FIELDS.map((field) => [field, details[field]])) as SalonDetails;

/** The salon's name and contact details, as customers see them on the booking page. Saved with Undo, listed in History. */
export function SalonDetailsForm() {
  const { state } = useStudio();
  const saved = pick(state.salon);
  const [draft, setDraft] = useState<SalonDetails>(saved);
  const [tried, setTried] = useState(false);
  const check = checkSalonDetails(draft);
  const problems = check.ok ? {} : check.problems;
  const dirty = SALON_DETAIL_FIELDS.some((field) => draft[field].trim() !== saved[field]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!check.ok || !dirty) return;
    if (dispatchWithUndoToast({ type: "salon/details", details: check.details }, t("salonDetails.saved"))) {
      setDraft(check.details);
      setTried(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 md:max-w-form">
      <form className="space-y-4" noValidate onSubmit={submit}>
        <p className="text-body text-text-secondary">{t("salonDetails.help")}</p>
        {SALON_DETAIL_FIELDS.map((field) => {
          const problem = problems[field];
          const shown = problem && (tried || draft[field].trim() !== saved[field]) ? t(`salonDetails.problem.${problem}`) : undefined;
          return (
            <Field width={field === "address" ? "full" : "short"} key={field} label={t(`salonDetails.${field}`)} hint={field === "name" ? undefined : t("salonDetails.optional")} error={shown}>
              <TextInput
                {...INPUT[field]}
                name={field}
                value={draft[field]}
                aria-invalid={!!shown || undefined}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
              />
            </Field>
          );
        })}
        {state.salon.orgNumber && <p className="text-meta text-text-secondary">{t("salonDetails.orgNumber", { number: state.salon.orgNumber })}</p>}
        <Button type="submit" width="responsive" disabled={!dirty}>{t("salonDetails.save")}</Button>
      </form>
    </Card>
  );
}
