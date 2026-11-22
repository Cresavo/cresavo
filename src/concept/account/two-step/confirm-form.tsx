"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Notice } from "../../ui/notice";
import { mfaError, postMfa, type MfaAnswer } from "../mfa-client";
import { StepHeading } from "../step-heading";

interface ConfirmFormProps {
  language: Locale;
  title: MessageKey;
  text: MessageKey;
  submit: MessageKey;
  path: string;
  /** Offer a recovery code instead of the app's code. */
  allowRecovery?: boolean;
  /** Ask for the app's code at all (not before setup has shown a secret). */
  askCode?: boolean;
  danger?: boolean;
  onDone: (answer: MfaAnswer, password: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** The current password, and a code from the app or a recovery code, for one two-step request. */
export function ConfirmForm({ language, title, text, submit, path, allowRecovery = false, askCode = true, danger = false, onDone, onCancel, children }: ConfirmFormProps) {
  const t = (key: MessageKey) => translate(language, key);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const code = String(form.get("code") ?? "");
    setBusy(true);
    setError(null);
    const answer = await postMfa(path, { password, ...(askCode ? (recovery ? { recoveryCode: code } : { code }) : {}) });
    setBusy(false);
    if (answer.ok) onDone(answer, password);
    else setError(mfaError(answer.status, answer.body.error));
  }

  return (
    <form onSubmit={send} className="space-y-4" noValidate>
      <StepHeading>{t(title)}</StepHeading>
      <p className="text-body text-text-secondary">{t(text)}</p>
      {children}
      <Field label={t("account.mfa.password")} hint={t("account.mfa.password.hint")}>
        <TextInput name="password" type="password" required maxLength={128} autoComplete="current-password" />
      </Field>
      {askCode && (recovery ? (
        <Field label={t("account.mfa.recoveryCode")}>
          <TextInput key="recovery" name="code" required maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
      ) : (
        <Field label={t("account.mfa.code")} hint={t("account.mfa.setup.codeHint")}>
          <TextInput key="totp" name="code" required maxLength={7} width="short" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" />
        </Field>
      ))}
      {allowRecovery && (
        <Button variant="tertiary" size="sm" className="text-action underline" onClick={() => { setRecovery(!recovery); setError(null); }}>
          {t(recovery ? "account.mfa.login.useApp" : "account.mfa.login.useRecovery")}
        </Button>
      )}
      {error && <Notice tone="danger" role="alert">{t(error)}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy}>{t(submit)}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("account.mfa.cancel")}</Button>
      </div>
    </form>
  );
}
