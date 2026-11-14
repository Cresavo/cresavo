"use client";
import { useEffect, type AnchorHTMLAttributes } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "./locale-provider";
import {
  contextualHref,
  returnHref,
  returnLabel,
  type ReturnContext,
} from "@/lib/navigation-context";

// History/tab storage keeps only opaque keys/coordinates, never URLs or contacts.
const HISTORY_KEY = "bookingScrollKey";
let explicitDepartureKey: string | undefined;
function currentScrollKey() {
  const saved = history.state?.[HISTORY_KEY];
  if (typeof saved === "string" && /^[a-f0-9-]{36}$/i.test(saved)) return saved;
  const key = crypto.randomUUID();
  history.replaceState({ ...history.state, [HISTORY_KEY]: key }, "");
  return key;
}
function rememberPosition(key: string) {
  for (const name of Object.keys(sessionStorage).filter((k) =>
    k.startsWith("booking-return:"),
  )) {
    const entry = JSON.parse(sessionStorage.getItem(name)!);
    if (Date.now() - entry.at > 1800000) sessionStorage.removeItem(name);
  }
  const keys = Object.keys(sessionStorage).filter((k) =>
    k.startsWith("booking-return:"),
  );
  for (const old of keys.slice(0, Math.max(0, keys.length - 19)))
    sessionStorage.removeItem(old);
  sessionStorage.setItem(
    `booking-return:${key}`,
    JSON.stringify({
      y: scrollY,
      calendarX:
        document.querySelector<HTMLElement>("[data-calendar-scroll]")
          ?.scrollLeft ?? 0,
      at: Date.now(),
    }),
  );
}
export function rememberReturn(href: string) {
  try {
    const key = currentScrollKey();
    rememberPosition(key);
    explicitDepartureKey = key;
    return contextualHref(href, {
      returnTo: location.pathname + location.search + location.hash,
      returnKey: key,
    });
  } catch {
    return contextualHref(href, {
      returnTo: location.pathname + location.search,
    });
  }
}
export default function ContextLink({
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.currentTarget.href = rememberReturn(href);
      }}
    />
  );
}
export function ReturnLink({
  context,
  fallback,
}: {
  context: ReturnContext;
  fallback: string;
}) {
  const href = returnHref(context, fallback);
  const locale = useLocale();
  return (
    <a className="context-back" href={href}>
      <ArrowLeft size={18} aria-hidden="true" />
      {returnLabel(href, locale)}
    </a>
  );
}
export function RestoreReturnScroll() {
  useEffect(() => {
    let stopPending = () => {};
    const restore = (fromHistory = false) => {
      const hashKey = /^#return-([a-f0-9-]{36})$/i.exec(location.hash)?.[1];
      const key =
        hashKey ?? (fromHistory ? history.state?.[HISTORY_KEY] : undefined);
      if (!key) return;
      try {
        const name = `booking-return:${key}`,
          raw = sessionStorage.getItem(name);
        if (!raw) return;
        const value = JSON.parse(raw);
        if (
          Number.isFinite(value.y) &&
          value.y >= 0 &&
          Number.isFinite(value.at) &&
          Date.now() >= value.at &&
          Date.now() - value.at < 1800000 &&
          Number.isFinite(value.calendarX ?? 0) &&
          (value.calendarX ?? 0) >= 0
        ) {
          stopPending();
          let frame = 0;
          // App Router can stream the real calendar after this root effect.
          // Wait for enough content; never fight an intentional user action.
          const stop = () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            clearTimeout(timer);
            window.removeEventListener("load", schedule);
            for (const event of ["wheel", "touchstart", "keydown"])
              window.removeEventListener(event, abandon);
          };
          const finish = () => {
            // Do not consume the intent until applied. StrictMode cleanup may
            // run before the first frame, and streamed content may arrive later.
            history.replaceState(
              { ...history.state, [HISTORY_KEY]: key },
              "",
              hashKey ? location.pathname + location.search : location.href,
            );
            stop();
          };
          const abandon = () => finish();
          const apply = () => {
            const calendar = document.querySelector<HTMLElement>(
              "[data-calendar-scroll]",
            );
            if (calendar) calendar.scrollLeft = value.calendarX ?? 0;
            window.scrollTo(0, value.y);
            finish();
          };
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              const calendar = document.querySelector<HTMLElement>(
                "[data-calendar-scroll]",
              );
              if (
                document.documentElement.scrollHeight - innerHeight + 1 >=
                  value.y &&
                (!(value.calendarX > 0) ||
                  (calendar &&
                    calendar.scrollWidth - calendar.clientWidth + 1 >=
                      value.calendarX))
              ) {
                apply();
              }
            });
          };
          const observer = new ResizeObserver(schedule);
          observer.observe(document.body);
          const timer = setTimeout(apply, 3000);
          window.addEventListener("load", schedule);
          for (const event of ["wheel", "touchstart", "keydown"])
            window.addEventListener(event, abandon, { passive: true });
          stopPending = stop;
          schedule();
        }
      } catch {
        /* The safe return link works even when storage is unavailable. */
      }
    };
    const show = (event: PageTransitionEvent) => {
      explicitDepartureKey = undefined;
      restore(event.persisted || isHistoryLoad);
    };
    const back = () => restore(true);
    const hash = () => restore();
    const save = () => {
      if (!location.pathname.startsWith("/admin")) return;
      try {
        const key = currentScrollKey();
        // Preserve the position captured by a contextual link. Mobile browsers
        // may adjust scroll between the click and pagehide during navigation.
        if (explicitDepartureKey !== key) rememberPosition(key);
      } catch {
        /* Storage is optional. */
      }
    };
    const isHistoryLoad =
      (
        performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined
      )?.type === "back_forward";
    restore(isHistoryLoad);
    window.addEventListener("pageshow", show);
    window.addEventListener("popstate", back);
    window.addEventListener("hashchange", hash);
    window.addEventListener("pagehide", save);
    return () => {
      stopPending();
      window.removeEventListener("pageshow", show);
      window.removeEventListener("popstate", back);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("pagehide", save);
    };
  }, []);
  return null;
}
