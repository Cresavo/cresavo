"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "../i18n";
import { IconButton } from "./button";
import { cx } from "./cx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "side";
  headerActions?: ReactNode;
}

/** Bottom sheet on phones, centred dialog on larger screens. Uses native <dialog>. */
export function Sheet({ open, onClose, title, description, children, footer, variant = "default", headerActions }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  const [present, setPresent] = useState(open);
  const [dismissing, setDismissing] = useState(false);
  const closing = !open || dismissing;
  const side = variant === "side";
  const dismiss = () => setDismissing(true);
  if (open && !present) setPresent(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!closing) {
      if (!dialog.open) {
        opener.current = dialog.ownerDocument.activeElement;
        dialog.showModal();
      }
      return;
    }
    if (!dialog.open) return;
    let cancelled = false;
    // The close event notifies callers after the exit, so they can safely unmount.
    Promise.allSettled(dialog.getAnimations().map(animation => animation.finished)).then(() => {
      if (cancelled || !dialog.open) return;
      dialog.close();
      const target = opener.current;
      if ((target instanceof HTMLElement || target instanceof SVGElement) &&
          target.isConnected && dialog.ownerDocument.activeElement !== target) {
        target.focus({ preventScroll: true });
      }
    });
    return () => { cancelled = true; };
  }, [closing]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? titleId + "-description" : undefined}
      data-closing={closing || undefined}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClose={event => {
        if (event.currentTarget.open) return;
        setPresent(false);
        setDismissing(false);
        if (open) onClose();
      }}
      onClick={event => { if (!side && event.target === event.currentTarget) dismiss(); }}
      className={cx(
        "ui-sheet m-0 w-full max-w-none overflow-hidden p-0 text-text shadow-sheet backdrop:bg-black/40",
        side ? "ui-sheet-side h-dvh bg-bg sm:ml-auto sm:rounded-l-lg" : "mt-auto rounded-t-lg bg-surface sm:m-auto sm:max-w-lg sm:rounded-lg",
      )}
    >
      {present && (
        <div inert={closing} className={cx("ui-sheet-body flex flex-col", side && "h-full")}>
          <header className={cx("flex px-4", side ? "ui-sheet-side-header items-center gap-1 border-b border-hairline bg-surface pb-2" : "items-start gap-3 pb-2 pt-4")}>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-h2 font-semibold tracking-tight">{title}</h2>
              {description && <p id={titleId + "-description"} className="mt-1 text-body text-text-secondary">{description}</p>}
            </div>
            {headerActions}
            <IconButton label={t("common.close")} onClick={dismiss} className={side ? "-mr-1" : "-mr-2 -mt-2"}>
              <X size={20} />
            </IconButton>
          </header>
          <div className={cx("min-h-0 flex-1", side ? "flex flex-col" : "overflow-y-auto px-4 pb-4")}>{children}</div>
          {footer && (
            <div className="ui-action-bar flex flex-wrap justify-end gap-2 border-t border-hairline px-4 pt-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
