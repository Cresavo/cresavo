"use client";

import { t } from "../i18n";
import { Sheet } from "./sheet";
import { Button } from "./button";

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  verb: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onClose, title, description, verb, destructive, onConfirm }: ConfirmProps) {
  return <Sheet open={open} onClose={onClose} title={title} description={description}>
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
      <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{verb}</Button>
    </div>
  </Sheet>;
}
