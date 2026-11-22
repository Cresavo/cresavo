"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Notice } from "../../ui/notice";
import { mfaError, postMfa } from "../mfa-client";
import { StepHeading } from "../step-heading";
import { ConfirmForm } from "./confirm-form";
import { QrCode } from "./qr-code";

type Shown = { otpauthUri: string; secret: string; password: string };

/** Groups the manual key in fours, as authenticator apps show it. */
const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/**
 * Setup in two steps: the password, then the QR code and manual key with the first code. On success the
 * recovery codes come back once and are handed to `onEnabled`. The password is kept in memory only between
 * the two steps, because turning it on asks for it again.
 */
export function TwoStepSetup({ language, onEnabled, onCancel }: { language: Locale; onEnabled: (codes: string[]) => void; onCancel: () => void }) {
  const t = (key: MessageKey) => translate(language, key);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  if (!shown) {
    return (
      <ConfirmForm language={language} title="account.mfa.setup.start" text="account.mfa.setup.text" submit="account.mfa.setup.continue"
        path="/api/owner/mfa/setup" askCode={false} onCancel={onCancel}
        onDone={(answer, password) => setShown({ otpauthUri: String(answer.body.otpauthUri), secret: String(answer.body.secret), password })} />
    );
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setBusy(true);
    setError(null);
    const answer = await postMfa("/api/owner/mfa/enable", { password: shown!.password, code });
    setBusy(false);
    if (answer.ok && Array.isArray(answer.body.recoveryCodes)) {
      setShown(null);
      onEnabled(answer.body.recoveryCodes.map(String));
    } else setError(mfaError(answer.status, answer.body.error));
  }

  return (
    <form method="post" onSubmit={confirm} className="space-y-4" noValidate>
      <StepHeading>{t("account.mfa.setup.start")}</StepHeading>
      <p className="text-body text-text-secondary">{t("account.mfa.setup.scan")}</p>
      <QrCode value={shown.otpauthUri} label={t("account.mfa.setup.qrLabel")} />
      <div className="space-y-1">
        <p className="text-meta text-text-secondary">{t("account.mfa.setup.manual")}</p>
        <p className="break-all font-mono text-body">{grouped(shown.secret)}</p>
      </div>
      <Field label={t("account.mfa.code")} hint={t("account.mfa.setup.codeHint")}>
        <TextInput name="code" required maxLength={7} width="short" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" />
      </Field>
      {error && <Notice tone="danger" role="alert">{t(error)}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>{t("account.mfa.setup.confirm")}</Button>
        <Button variant="secondary" onClick={() => { setShown(null); onCancel(); }}>{t("account.mfa.cancel")}</Button>
      </div>
    </form>
  );
}
