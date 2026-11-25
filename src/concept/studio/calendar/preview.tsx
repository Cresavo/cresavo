"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { t } from "../../i18n";
import { formatDayLong, formatTime } from "../../i18n/format";
import { findCustomer, findService, visitorName } from "../../selectors";
import { useStudio } from "../use-studio";

/** The id the previewed block points to with `aria-describedby`. */
export const PREVIEW_ID = "calendar-preview";
/** How long the pointer rests on a block before its details show; passing over the week shows nothing. */
const REST_MS = 400;
const GAP = 8;
const EDGE = 16;
const DESKTOP = "(min-width: 1024px)";

type Shown = { id: string; anchor: HTMLElement };

let shown: Shown | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const publish = (next: Shown | null) => {
  shown = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Show one booking's details beside its block: at once for keyboard focus, after a short rest for the pointer.
 * Desktop only; a phone opens the booking with a tap.
 */
export function previewBooking(id: string, anchor: HTMLElement, from: "pointer" | "focus") {
  clearTimeout(timer);
  if (!window.matchMedia(DESKTOP).matches) return;
  if (from === "focus") publish({ id, anchor });
  else timer = setTimeout(() => publish({ id, anchor }), REST_MS);
}

export function hidePreview(id?: string) {
  clearTimeout(timer);
  if (shown && (!id || shown.id === id)) publish(null);
}

export function usePreviewedId(): string | null {
  return useSyncExternalStore(subscribe, () => shown?.id ?? null, () => null);
}

/** Beside the block on the side with room, kept inside the window. */
export function previewPosition(anchor: { left: number; right: number; top: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const right = anchor.right + GAP;
  const left = right + size.width <= viewport.width - EDGE ? right : Math.max(EDGE, anchor.left - GAP - size.width);
  const top = Math.min(Math.max(anchor.top, EDGE), Math.max(EDGE, viewport.height - EDGE - size.height));
  return { left, top };
}

/**
 * The calendar's one quiet preview: customer, treatment, time and phone, on a single surface with nothing boxed
 * inside it. It never takes the pointer or focus, so a click still opens the booking as before.
 */
export function CalendarPreview() {
  const { state } = useStudio();
  const current = useSyncExternalStore(subscribe, () => shown, () => null);
  const panel = useRef<HTMLDivElement>(null);
  const booking = current ? state.bookings.find((entry) => entry.id === current.id) : undefined;

  useLayoutEffect(() => {
    const element = panel.current;
    if (!current || !element) return;
    const { left, top } = previewPosition(current.anchor.getBoundingClientRect(), { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.visibility = "visible";
    // A scrolled page or a closed block leaves nothing to point at.
    const away = () => hidePreview();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") hidePreview(); };
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("keydown", escape);
    };
  }, [current]);

  if (!current || !booking || !current.anchor.isConnected) return null;
  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  return createPortal(
    <div
      ref={panel}
      id={PREVIEW_ID}
      role="tooltip"
      className="studio-peek pointer-events-none fixed z-popover w-72 space-y-1 rounded-lg border border-hairline bg-surface px-4 py-3 text-meta text-text shadow-raised"
      style={{ left: 0, top: 0, visibility: "hidden" }}
    >
      <p className="text-body font-semibold">{visitorName(booking, customer)}</p>
      {service && <p>{service.name}</p>}
      <p className="tabular-nums text-text-secondary">
        {t("calendar.preview.when", { day: formatDayLong(booking.date), from: formatTime(booking.start), to: formatTime(booking.start + booking.duration) })}
      </p>
      {customer?.phone && <p className="tabular-nums text-text-secondary">{customer.phone}</p>}
    </div>,
    // Inside the studio's root, so the preview wears its fonts and theme.
    current.anchor.closest(".studio-root") ?? document.body,
  );
}
