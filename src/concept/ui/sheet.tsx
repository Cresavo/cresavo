"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
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
  /**
   * On a wide screen, open as a quiet panel docked at the window's right edge instead of a modal dialog, so the
   * page beside it stays visible and usable (the calendar's week while a booking is moved). Phones keep the sheet.
   */
  dock?: boolean;
  /** Called once the sheet has finished closing and focus is back where it was, however it was closed. */
  onExited?: () => void;
}

/** Wide enough for a docked panel and the page beside it. */
const DOCK_QUERY = "(min-width: 1280px)";

/** Bottom sheet on phones, centred dialog on larger screens. Uses native <dialog>. */
export function Sheet({ open, onClose, title, description, children, footer, variant = "default", headerActions, dock = false, onExited }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  const [present, setPresent] = useState(open);
  const [dismissing, setDismissing] = useState(false);
  const closing = !open || dismissing;
  const side = variant === "side";
  const dismiss = () => setDismissing(true);
  if (open && !present) setPresent(true);
  useVisibleArea(ref, side && !closing);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!closing) {
      if (!dialog.open) {
        opener.current = dialog.ownerDocument.activeElement;
        const docked = dock && !side && !!dialog.ownerDocument.defaultView?.matchMedia(DOCK_QUERY).matches;
        // Set once at opening: a panel stays a panel (and a dialog a dialog) until it closes.
        if (dock) dialog.toggleAttribute("data-docked", docked);
        if (docked) dialog.show();
        else dialog.showModal();
      }
      // A docked panel is not modal: Escape must still close it after focus has moved back to the page.
      if (dialog.hasAttribute("data-docked")) {
        const onEscape = (event: KeyboardEvent) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          // A nested open dialog (Move, for example) takes Escape first.
          const others = [...dialog.ownerDocument.querySelectorAll("dialog[open]")].filter((node) => node !== dialog);
          if (others.length) return;
          event.preventDefault();
          setDismissing(true);
        };
        dialog.ownerDocument.addEventListener("keydown", onEscape);
        return () => dialog.ownerDocument.removeEventListener("keydown", onEscape);
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
  }, [closing, dock, side]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? titleId + "-description" : undefined}
      data-closing={closing || undefined}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      // A docked panel is not modal, so the browser gives it no Escape of its own.
      onKeyDown={event => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        const root = event.currentTarget;
        if (!root.hasAttribute("data-docked")) return;
        // A nested open dialog (Edit contact, Move) takes Escape first; do not close the panel under it.
        const others = [...root.ownerDocument.querySelectorAll("dialog[open]")].filter((node) => node !== root);
        if (others.length) return;
        event.preventDefault();
        dismiss();
      }}
      onClose={event => {
        if (event.currentTarget.open) return;
        setPresent(false);
        setDismissing(false);
        if (open) onClose();
        onExited?.();
      }}
      onClick={event => { if (!side && event.target === event.currentTarget) dismiss(); }}
      className={cx(
        "ui-sheet m-0 w-full max-w-none overflow-hidden p-0 text-text shadow-sheet backdrop:bg-black/40",
        side ? "ui-sheet-side bg-bg sm:ml-auto sm:rounded-l-lg" : "mt-auto rounded-t-lg bg-surface sm:m-auto sm:max-w-lg sm:rounded-lg",
      )}
    >
      {present && (
        <div inert={closing} className={cx("ui-sheet-body flex flex-col", side && "h-full")}>
          <div data-sheet-header className={cx("flex px-4", side ? "ui-sheet-side-header items-center gap-1 border-b border-hairline bg-surface pb-2" : "items-start gap-3 pb-2 pt-4")}>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-h2 font-semibold tracking-tight">{title}</h2>
              {description && <p id={titleId + "-description"} className="mt-1 text-body text-text-secondary">{description}</p>}
            </div>
            {headerActions}
            <IconButton label={t("common.close")} onClick={dismiss} className={side ? "-mr-1" : "-mr-2 -mt-2"}>
              <X size={20} />
            </IconButton>
          </div>
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

/**
 * On phones the on-screen keyboard covers the bottom of a full-height panel and the browser scrolls the page to
 * reveal the focused field, which pushes the header away. The panel follows the visible area instead.
 */
function useVisibleArea(ref: RefObject<HTMLDialogElement | null>, active: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    const view = dialog?.ownerDocument.defaultView?.visualViewport;
    if (!active || !dialog || !view) return;
    const clear = () => {
      dialog.style.removeProperty("--sheet-top");
      dialog.style.removeProperty("--sheet-height");
    };
    const follow = () => {
      // Pinch zoom moves the visible area too; the panel stays put then.
      if (Math.abs(view.scale - 1) > 0.01) return clear();
      dialog.style.setProperty("--sheet-top", `${view.offsetTop}px`);
      dialog.style.setProperty("--sheet-height", `${view.height}px`);
    };
    follow();
    view.addEventListener("resize", follow);
    view.addEventListener("scroll", follow);
    return () => {
      view.removeEventListener("resize", follow);
      view.removeEventListener("scroll", follow);
      clear();
    };
  }, [ref, active]);
}
