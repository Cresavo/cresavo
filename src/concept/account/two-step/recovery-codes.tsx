"use client";

import { useState } from "react";
import { BRAND } from "@/concept/brand";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { StepHeading } from "../step-heading";

/** The recovery codes, shown once, with copy and download, until the owner says they are saved. */
export function RecoveryCodes({ codes, email, language, onSaved }: { codes: string[]; email: string; language: Locale; onSaved: () => void }) {
  const t = (key: MessageKey, vars?: Record<string, string>) => translate(language, key, vars);
  const [copied, setCopied] = useState(false);
  const text = [t("account.mfa.codes.file", { brand: BRAND.name, email }), "", ...codes, ""].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4" aria-labelledby="recovery-codes-title">
      <StepHeading id="recovery-codes-title">{t("account.mfa.codes.title")}</StepHeading>
      <p className="text-body text-text-secondary">{t("account.mfa.codes.text")}</p>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-surface-2 p-4 font-mono text-body tabular-nums">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>{t("account.mfa.codes.copy")}</Button>
        <Button variant="secondary" onClick={download}>{t("account.mfa.codes.download")}</Button>
      </div>
      <p role="status" className="text-meta text-text-secondary">{copied ? t("account.mfa.codes.copied") : ""}</p>
      <Button onClick={onSaved}>{t("account.mfa.codes.saved")}</Button>
    </section>
  );
}
