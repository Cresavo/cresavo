"use client";

import { useState } from "react";
import { t } from "../i18n";
import { actionReference } from "../support/action-reference";
import { Button } from "./button";
import { Notice } from "./notice";

export interface ActionFailureInfo {
  message: string;
  requestId: string;
}

export function ActionFailure({ failure, audience = "studio" }: {
  failure: ActionFailureInfo; audience?: "booking" | "studio";
}) {
  const reference = actionReference(failure.requestId);
  const [copy, setCopy] = useState<{ reference: string; ok: boolean }>();
  const copied = copy?.reference === reference && copy.ok;
  return (
    <div className="w-full space-y-1 rounded-md bg-surface text-sm text-text">
      <Notice tone="danger" role="alert">
        <span className="block">{failure.message}</span>
        <span className="mt-1 block">{t(audience === "booking" ? "reference.salonHint" : "reference.supportHint")} <code className="select-all font-mono font-semibold">{reference}</code></span>
      </Notice>
      <div className="flex flex-wrap items-center gap-x-2 px-2 pb-1">
        <Button size="sm" variant="ghost" onClick={async () => {
          try {
            await navigator.clipboard.writeText(reference);
            setCopy({ reference, ok: true });
          } catch {
            setCopy({ reference, ok: false });
          }
        }}>{t(copied ? "common.copied" : "common.copy")}</Button>
        <span role="status" className={copied ? "sr-only" : "text-text-secondary"}>
          {copy?.reference === reference && t(copied ? "common.copied" : "reference.copyFailed")}
        </span>
      </div>
    </div>
  );
}
