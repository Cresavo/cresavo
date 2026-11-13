"use client";
import { useEffect, type AnchorHTMLAttributes } from "react";
import { ArrowLeft } from "lucide-react";
import {
  contextualHref,
  returnHref,
  returnLabel,
  type ReturnContext,
} from "@/lib/navigation-context";

// Tab storage keeps only opaque keys/scroll coordinates, never URLs or contacts.
export function rememberReturn(href: string) {
  try {
    const key = crypto.randomUUID();
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
      JSON.stringify({ y: scrollY, at: Date.now() }),
    );
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
  return (
    <a className="context-back" href={href}>
      <ArrowLeft size={18} aria-hidden="true" />
      {returnLabel(href)}
    </a>
  );
}
export function RestoreReturnScroll() {
  useEffect(() => {
    let stopPending = () => {};
    const restore = () => {
      const key = /^#return-([a-f0-9-]{36})$/i.exec(location.hash)?.[1];
      if (!key) return;
      try {
        const name = `booking-return:${key}`,
          raw = sessionStorage.getItem(name);
        if (!raw) return;
        const value = JSON.parse(raw);
        sessionStorage.removeItem(name);
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
        if (
          Number.isFinite(value.y) &&
          value.y >= 0 &&
          Number.isFinite(value.at) &&
          Date.now() >= value.at &&
          Date.now() - value.at < 1800000
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
              window.removeEventListener(event, stop);
          };
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              if (
                document.documentElement.scrollHeight - innerHeight + 1 >=
                value.y
              ) {
                window.scrollTo(0, value.y);
                stop();
              }
            });
          };
          const observer = new ResizeObserver(schedule);
          observer.observe(document.body);
          const timer = setTimeout(() => {
            window.scrollTo(0, value.y);
            stop();
          }, 3000);
          window.addEventListener("load", schedule);
          for (const event of ["wheel", "touchstart", "keydown"])
            window.addEventListener(event, stop, { passive: true });
          stopPending = stop;
          schedule();
        }
      } catch {
        /* The safe return link works even when storage is unavailable. */
      }
    };
    restore();
    window.addEventListener("pageshow", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      stopPending();
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);
  return null;
}
