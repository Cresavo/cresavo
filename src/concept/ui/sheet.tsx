"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "../i18n";
import { IconButton } from "./button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet on phones, centred dialog on larger screens. Uses native <dialog>. */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (open || !dialog.open) return;
    let cancelled = false;
    // Use the CSS animation's actual completion, including reduced motion.
    Promise.allSettled(dialog.getAnimations().map(animation => animation.finished)).then(() => {
      if (!cancelled && dialog.open) dialog.close();
    });
    return () => { cancelled = true; };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? titleId + "-description" : undefined}
      data-closing={!open || undefined}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClose={event => {
        if (event.currentTarget.open) return;
        setPresent(false);
        if (open) onClose();
      }}
      onClick={(event) => event.target === ref.current && onClose()}
      className="ui-sheet m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-lg bg-surface p-0 text-text shadow-sheet backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-lg"
    >
      {present && (
        <div inert={!open} className="ui-sheet-body flex flex-col">
          <div className="flex items-start gap-3 px-4 pb-2 pt-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-h2 font-semibold tracking-tight">{title}</h2>
              {description && <p id={titleId + "-description"} className="mt-1 text-body text-text-secondary">{description}</p>}
            </div>
            <IconButton label={t("common.close")} onClick={onClose} className="-mr-2 -mt-2">
              <X size={20} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
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
