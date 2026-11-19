"use client";

import { useState } from "react";
import { t } from "../i18n";
import { Button } from "./button";
import { Sheet } from "./sheet";

interface ConsentProps {
  open: boolean;
  title: string;
  summary: string;
  grants: readonly string[];
  verb: string;
  highRisk?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ConsentForm({ grants, highRisk, verb, onConfirm, onClose }: ConsentProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (!highRisk || acknowledged) onConfirm();
    }}>
      <ul className="list-disc space-y-1 pl-6 text-body">{grants.map(grant => <li key={grant}>{grant}</li>)}</ul>
      {highRisk && <label className="flex min-h-target items-center gap-3 text-body">
        <input type="checkbox" required checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="size-4 shrink-0 accent-action" />
        {t("ui.acknowledge")}
      </label>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={highRisk && !acknowledged}>{verb}</Button>
      </div>
    </form>
  );
}

export function ConsentSheet(props: ConsentProps) {
  return <Sheet open={props.open} onClose={props.onClose} title={props.title} description={props.summary}>
    <ConsentForm key={JSON.stringify([props.open, props.highRisk, props.title, props.summary, props.grants, props.verb])} {...props} />
  </Sheet>;
}
