"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useBook } from "./booking";

export type ShowcaseTheme = "light" | "dark";

const listeners = new Set<() => void>();
const pinned = new Map<string, ShowcaseTheme>();

function subscribe(change: () => void) {
  listeners.add(change);
  addEventListener("storage", change);
  return () => { listeners.delete(change); removeEventListener("storage", change); };
}

/**
 * Light or dark for one showcase site. Each site starts in its own scheme (the classic one light, the bold one
 * dark) until the visitor flips it; the choice is kept in this browser under the site's own key.
 */
export function useShowcaseTheme(key: string, initial: ShowcaseTheme) {
  const read = () => {
    try {
      const value = localStorage.getItem(key);
      if (value === "light" || value === "dark") return value;
    } catch { /* blocked storage: this visit's choice stands */ }
    return pinned.get(key) ?? initial;
  };
  const theme = useSyncExternalStore(subscribe, read, () => initial);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    pinned.set(key, next);
    try { localStorage.setItem(key, next); } catch { /* the choice still holds for this visit */ }
    listeners.forEach((change) => change());
  };
  return { theme, toggle };
}

/**
 * The phone's booking bar: it appears once the hero's own "Boka" has scrolled away and steps aside while the
 * booking itself is on screen, so there is never a second booking button in view.
 */
export function BookBar({ className, label, hero, booking = "boka" }: { className: string; label: string; hero: string; booking?: string }) {
  const book = useBook();
  const [heroVisible, setHeroVisible] = useState(true);
  const [bookingVisible, setBookingVisible] = useState(false);
  useEffect(() => {
    const watch = (id: string, set: (visible: boolean) => void) => {
      const target = document.getElementById(id);
      if (!target) return;
      const observer = new IntersectionObserver(([entry]) => set(entry.isIntersecting));
      observer.observe(target);
      return observer;
    };
    const observers = [watch(hero, setHeroVisible), watch(booking, setBookingVisible)];
    return () => observers.forEach((observer) => observer?.disconnect());
  }, [hero, booking]);
  const hidden = heroVisible || bookingVisible;
  return (
    <div className={className} data-hidden={hidden ? "" : undefined} inert={hidden}>
      <button type="button" onClick={() => book()}>{label}</button>
    </div>
  );
}
