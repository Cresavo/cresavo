"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../i18n";
import { closeAccountSalon } from "../store";
import { Button } from "../ui/button";
import { Field, Select, TextInput } from "../ui/controls";
import { Notice } from "../ui/notice";
import { SecondStep } from "./second-step";
import { signalSessionChange } from "./session-signal";

type Mode = "signup" | "login";

const KNOWN_ERRORS = ["invalid", "email_taken", "slug_unavailable", "invalid_credentials"] as const;

/** The message for a failed request: the API's error code, or a rate limit, or a generic failure. */
export function accountError(status: number, code: unknown): MessageKey {
  if (status === 429) return "account.error.tooMany";
  return KNOWN_ERRORS.includes(code as (typeof KNOWN_ERRORS)[number]) ? `account.error.${code as (typeof KNOWN_ERRORS)[number]}` : "account.error.generic";
}

/** Sign-up and sign-in for salon owners. On success the owner lands on /account. */
export function AccountForm({ mode, language }: { mode: Mode; language: Locale }) {
  const t = (key: MessageKey) => translate(language, key);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [secondStep, setSecondStep] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = mode === "signup"
      ? { email: form.get("email"), password: form.get("password"), salonName: form.get("salonName"), language: form.get("language") }
      : { email: form.get("email"), password: form.get("password") };
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/owner/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.next === "mfa") {
        setSecondStep(true);
        return;
      }
      if (response.ok) {
        signalSessionChange();
        router.push("/account");
        router.refresh();
        return;
      }
      setError(response.status === 503 && data.error === "not_configured" ? "account.error.not_configured" : accountError(response.status, data.error));
    } catch {
      setError("account.error.generic");
    } finally {
      setBusy(false);
    }
  }

  if (secondStep) return <SecondStep language={language} onRestart={(reason) => { setSecondStep(false); setError(reason); }} />;
  const signup = mode === "signup";
  return (
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
      <h1 className="text-h1 font-semibold tracking-tight">{t(signup ? "account.signup.title" : "account.login.title")}</h1>
      {signup && <p className="text-body text-text-secondary">{t("account.signup.text")}</p>}
      {signup && (
        <Field label={t("account.salonName")}>
          <TextInput id="account-salon" name="salonName" required maxLength={80} autoComplete="organization" />
        </Field>
      )}
      <Field label={t("account.email")}>
        <TextInput id="account-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" />
      </Field>
      <Field label={t("account.password")} hint={signup ? t("account.password.hint") : undefined}>
        <TextInput id="account-password" name="password" type="password" required minLength={signup ? 15 : 1} maxLength={128}
          autoComplete={signup ? "new-password" : "current-password"} />
      </Field>
      {signup && (
        <Field label={t("account.language")}>
          <Select id="account-language" name="language" defaultValue={language}>
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </Select>
        </Field>
      )}
      {error && <Notice tone="danger" role="alert">{t(error)}</Notice>}
      {!signup && (
        <p className="text-meta">
          <Link className="font-medium text-action underline" href="/account/reset">{t("account.login.forgot")}</Link>
        </p>
      )}
      <Button type="submit" width="responsive" loading={busy}>{t(signup ? "account.signup.submit" : "account.login.submit")}</Button>
      <p className="text-meta text-text-secondary">
        {t(signup ? "account.signup.haveAccount" : "account.login.noAccount")}{" "}
        <Link className="font-medium text-action underline" href={signup ? "/account/login" : "/account/signup"}>
          {t(signup ? "account.login.link" : "account.login.createLink")}
        </Link>
      </p>
    </form>
  );
}

/** Ends the session and returns to the sign-in page. */
export function SignOutButton({ language }: { language: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch("/api/owner/logout", { method: "POST" }).catch(() => undefined);
    signalSessionChange();
    router.push("/account/login");
    router.refresh();
  }
  return <Button variant="secondary" loading={busy} onClick={signOut}>{translate(language, "account.logout")}</Button>;
}

/** Ends every session of the account, on every device, and returns to the sign-in page. */
export function SignOutEverywhereButton({ language }: { language: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function signOutEverywhere() {
    setBusy(true);
    setFailed(false);
    const response = await fetch("/api/owner/logout-all", { method: "POST" }).catch(() => undefined);
    // 401 means this session had already ended; the other devices may still be signed in, so ask the owner to sign in and retry.
    if (!response?.ok) {
      setFailed(true);
      setBusy(false);
      return;
    }
    closeAccountSalon();
    signalSessionChange();
    router.push("/account/login");
    router.refresh();
  }
  return (
    <div className="space-y-2">
      {failed && <Notice tone="danger" role="alert">{translate(language, "account.logoutAll.failed")}</Notice>}
      <Button variant="secondary" loading={busy} onClick={signOutEverywhere}>{translate(language, "account.logoutAll")}</Button>
    </div>
  );
}
