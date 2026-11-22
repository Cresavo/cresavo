import { useEffect, type RefObject } from "react";
import { panelSkeleton } from "./dot-engine";

/**
 * Lets blocks marked `data-reveal` that start below the fold rise in as they
 * scroll into view; everything else is visible from the first paint, and
 * reduced motion shows everything as it is. A revealed product panel
 * (`data-reveal="panel"`) resolves from a faint dot skeleton.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const blocks = [...scope.querySelectorAll<HTMLElement>("[data-reveal]")].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.94);
    const cleanups: (() => void)[] = [];
    const show = (el: HTMLElement, skeleton: boolean) => {
      if (!el.hasAttribute("data-pending")) return;
      el.removeAttribute("data-pending");
      if (skeleton && el.dataset.reveal === "panel") cleanups.push(panelSkeleton(el, getComputedStyle(el).columnRuleColor));
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        show(entry.target as HTMLElement, true);
      }
    }, { rootMargin: "0px 0px -6% 0px" });
    const all = () => blocks.forEach((el) => show(el, false));
    for (const el of blocks) {
      el.setAttribute("data-pending", "");
      observer.observe(el);
    }
    addEventListener("beforeprint", all);
    return () => {
      observer.disconnect();
      removeEventListener("beforeprint", all);
      all();
      cleanups.forEach((stop) => stop());
    };
  }, [root]);
}
