"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../i18n";
import { Button } from "../ui/button";
import { Field, TextInput } from "../ui/controls";
import { Notice } from "../ui/notice";
import { mfaError, postMfa } from "./mfa-client";
import { StepHeading } from "./step-heading";

/**
 * The second step of a sign-in: a code from the authenticator app, or a recovery code. `onRestart` goes back to
 * the password step, with a message when the pending sign-in ran out.
 */
export function SecondStep({ language, onRestart }: { language: Locale; onRestart: (error: MessageKey | null) => void }) {
  const t = (key: MessageKey) => translate(language, key);
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("code") ?? "");
    setBusy(true);
    setError(null);
    const answer = await postMfa("/api/owner/login/mfa", recovery ? { recoveryCode: value } : { code: value });
    if (answer.ok) {
      router.push("/account");
      router.refresh();
      return;
    }
    setBusy(false);
    if (answer.body.error === "mfa_expired") onRestart("account.error.mfa_expired");
    else setError(answer.status === 0 ? "account.error.generic" : mfaError(answer.status, answer.body.error));
  }

  function switchMode() {
    setRecovery(!recovery);
    setError(null);
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
      <StepHeading level={1} focus={false}>{t("account.mfa.title")}</StepHeading>
      <p className="text-body text-text-secondary">{t(recovery ? "account.mfa.login.recoveryText" : "account.mfa.login.text")}</p>
      {recovery ? (
        <Field label={t("account.mfa.recoveryCode")}>
          <TextInput key="recovery" id="account-recovery-code" name="code" required maxLength={20} autoComplete="off" autoCapitalize="none"
            spellCheck={false} autoFocus />
        </Field>
      ) : (
        <Field label={t("account.mfa.code")}>
          <TextInput key="totp" id="account-code" name="code" required maxLength={7} width="short" autoComplete="one-time-code" inputMode="numeric"
            pattern="[0-9 ]*" autoFocus />
        </Field>
      )}
      {error && <Notice tone="danger" role="alert">{t(error)}</Notice>}
      <Button type="submit" width="responsive" loading={busy}>{t("account.mfa.login.submit")}</Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="tertiary" size="sm" className="text-action underline" onClick={switchMode}>
          {t(recovery ? "account.mfa.login.useApp" : "account.mfa.login.useRecovery")}
        </Button>
        <Button variant="tertiary" size="sm" className="text-action underline" onClick={() => onRestart(null)}>
          {t("account.mfa.login.restart")}
        </Button>
      </div>
    </form>
  );
}
