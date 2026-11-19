"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface MediaDialogProps {
  title: string;
  closeLabel: string;
  ratio: number;
  mediaRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/** Mount to open a preview with native media controls. Unmount in onClose. */
export function MediaDialog({ title, closeLabel, ratio, mediaRef, onClose, children }: MediaDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    close.current?.focus();
  }, []);

  return (
    <dialog ref={dialog} className="ui-media-dialog" aria-label={title} onClose={onClose}
      style={{ "--media-ratio": ratio } as CSSProperties}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      {/* Tab reaches the native media controls before returning to Close. */}
      <span tabIndex={0} className="sr-only" onFocus={() => mediaRef.current?.focus()} />
      <div className="ui-media-panel">
        <header className="flex items-center justify-between gap-3 py-1 pl-2">
          <strong className="text-body font-semibold">{title}</strong>
          <Button ref={close} variant="tertiary" icon={<X size={18} aria-hidden />} onClick={() => dialog.current?.close()}>{closeLabel}</Button>
        </header>
        {children}
      </div>
      <span tabIndex={0} className="sr-only" onFocus={() => close.current?.focus()} />
    </dialog>
  );
}
