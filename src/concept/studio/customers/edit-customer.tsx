"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { correctedCustomer, MAX_TAG_LENGTH, MAX_TAGS, type CustomerPatch, type PatchProblem } from "../../customers/rights";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Checkbox, Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { currentState } from "../../store";
import { dispatchWithUndoToast } from "../log/undo-toast";

const PROBLEM_KEYS: Partial<Record<PatchProblem, MessageKey>> = {
  firstName: "customer.edit.error.firstName",
  phone: "customer.edit.error.phone",
  phoneTaken: "customer.edit.error.phoneTaken",
  email: "customer.edit.error.email",
  emailTaken: "customer.edit.error.emailTaken",
  birthday: "customer.edit.error.birthday",
  tags: "customer.edit.error.tags",
};

const splitTags = (text: string) => text.split(",").map((tag) => tag.trim()).filter(Boolean);

/** Correction of a customer's card (GDPR art. 16): every personal field, including the waiting-list consent. */
export function EditCustomer({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formOf(customer));
  const [problem, setProblem] = useState<PatchProblem | null>(null);

  const start = () => {
    setForm(formOf(customer));
    setProblem(null);
    setOpen(true);
  };

  const save = () => {
    const patch = changes(customer, form);
    if (!Object.keys(patch).length) {
      setOpen(false);
      return;
    }
    const state = currentState();
    const checked = state ? correctedCustomer(state, customer.id, patch) : null;
    if (checked && "problem" in checked) {
      setProblem(checked.problem);
      return;
    }
    if (dispatchWithUndoToast({ type: "customer/update", id: customer.id, patch }, t("customer.edit.saved"))) setOpen(false);
    else setProblem("unknown");
  };

  const message = (field: PatchProblem[]) => (problem && field.includes(problem) ? t(PROBLEM_KEYS[problem]!) : undefined);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <Button variant="secondary" width="responsive" icon={<Pencil size={18} />} onClick={start}>{t("customer.edit")}</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("customer.edit.title", { name: customer.firstName })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save}>{t("common.save")}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("customer.edit.firstName")} error={message(["firstName"])}>
            <TextInput value={form.firstName} maxLength={60} autoComplete="off" autoCapitalize="words" onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label={t("customer.edit.lastName")}>
            <TextInput value={form.lastName} maxLength={60} autoComplete="off" autoCapitalize="words" onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label={t("customer.edit.phone")} error={message(["phone", "phoneTaken"])}>
            <TextInput type="tel" inputMode="tel" value={form.phone} maxLength={30} autoComplete="off" onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label={t("customer.edit.email")} error={message(["email", "emailTaken"])}>
            <TextInput type="email" inputMode="email" value={form.email} maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t("customer.edit.birthday")} error={message(["birthday"])}>
            <TextInput type="date" value={form.birthday} autoComplete="off" onChange={(e) => set("birthday", e.target.value)} />
          </Field>
          <Field label={t("customer.edit.tags")} hint={t("customer.edit.tagsHint")} error={message(["tags"])}>
            <TextInput value={form.tags} maxLength={MAX_TAGS * (MAX_TAG_LENGTH + 2)} autoComplete="off" onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <div className="space-y-1">
            <Checkbox label={t("customer.edit.waitlist")} checked={form.waitlist} onChange={(e) => set("waitlist", e.target.checked)} />
            <p className="text-meta text-text-secondary">{t("customer.edit.waitlistHint")}</p>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function formOf(customer: Customer) {
  return {
    firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email,
    birthday: customer.birthday ?? "", tags: customer.tags.join(", "), waitlist: customer.waitlist,
  };
}

/** Only the fields the owner changed, so a correction never overwrites a field another change touched meanwhile. */
function changes(customer: Customer, form: ReturnType<typeof formOf>): CustomerPatch {
  const patch: CustomerPatch = {};
  if (form.firstName.trim() !== customer.firstName) patch.firstName = form.firstName;
  if (form.lastName.trim() !== customer.lastName) patch.lastName = form.lastName;
  if (form.phone.trim() !== customer.phone) patch.phone = form.phone;
  if (form.email.trim().toLowerCase() !== customer.email) patch.email = form.email;
  if (form.birthday !== (customer.birthday ?? "")) patch.birthday = form.birthday || null;
  const tags = splitTags(form.tags);
  if (JSON.stringify(tags) !== JSON.stringify(customer.tags)) patch.tags = tags;
  if (form.waitlist !== customer.waitlist) patch.waitlist = form.waitlist;
  return patch;
}
