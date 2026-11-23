"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../i18n";
import { Button } from "../ui/button";
import { Field, TextInput } from "../ui/controls";
import { Notice } from "../ui/notice";

/** The token in the address fragment (`#t=...`), which never reaches a server log or a Referer header. */
const tokenIn = (hash: string) => /(?:^#|&)t=([A-Za-z0-9._-]{1,200})(?:&|$)/.exec(hash)?.[1] ?? null;

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, error: (data as { error?: unknown }).error };
}

/**
 * Both steps of a password reset on one page. Without a token in the address it asks for the e-mail; with one
 * (from the e-mailed link) it asks for the new password. The token is taken out of the address bar at once.
 */
export function ResetForm({ language }: { language: Locale }) {
  const t = (key: MessageKey) => translate(language, key);
  // Read once on the client (undefined on the server and while hydrating), then kept: the address bar is cleaned below.
  const captured = useRef<string | null | undefined>(undefined);
  const token = useSyncExternalStore(
    () => () => undefined,
    () => (captured.current ??= tokenIn(window.location.hash)),
    () => undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = token
        ? await post("/api/owner/password/reset", { token, password: form.get("password") })
        : await post("/api/owner/password/reset-request", { email: form.get("email") });
      if (result.ok) setDone(true);
      else if (result.status === 429) setError("account.error.tooMany");
      else if (token) setError(result.error === "invalid_token" ? "account.reset.error.invalid_token" : "account.reset.error.invalid");
      else setError("account.error.generic");
    } catch {
      setError("account.error.generic");
    } finally {
      setBusy(false);
    }
  }

  if (token === undefined) return null;
  const back = (
    <Link className="font-medium text-action underline" href="/account/login">
      {t(done && token ? "account.reset.toLogin" : "account.reset.backToLogin")}
    </Link>
  );
  if (done) {
    return (
      <div className="space-y-5">
        <h1 className="text-h1 font-semibold tracking-tight">{t("account.reset.title")}</h1>
        <Notice tone="success" role="status">{t(token ? "account.reset.done" : "account.reset.sent")}</Notice>
        <p className="text-meta">{back}</p>
      </div>
    );
  }
  return (
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
      <h1 className="text-h1 font-semibold tracking-tight">{t(token ? "account.reset.newTitle" : "account.reset.title")}</h1>
      <p className="text-body text-text-secondary">{t(token ? "account.reset.newText" : "account.reset.requestText")}</p>
      {token ? (
        <Field label={t("account.reset.newPassword")} hint={t("account.password.hint")}>
          <TextInput id="reset-password" name="password" type="password" required minLength={15} maxLength={128} autoComplete="new-password" />
        </Field>
      ) : (
        <Field label={t("account.email")}>
          <TextInput id="reset-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" />
        </Field>
      )}
      {error && <Notice tone="danger" role="alert">{t(error)}</Notice>}
      <Button type="submit" width="responsive" loading={busy}>{t(token ? "account.reset.newSubmit" : "account.reset.requestSubmit")}</Button>
      <p className="text-meta">{back}</p>
    </form>
  );
}
