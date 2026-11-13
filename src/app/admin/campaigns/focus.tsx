"use client";
import { useEffect } from "react";
// This boundary mounts with the streamed list, after the target exists.
export default function FocusCampaign() {
  useEffect(() => {
    const focus = () => {
      if (!/^#campaign-[a-zA-Z0-9_-]{1,128}$/.test(location.hash)) return;
      const panel = document.getElementById(location.hash.slice(1));
      const heading = panel?.querySelector("h2");
      if (panel && heading) {
        panel.scrollIntoView({ block: "start" });
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    };
    focus();
    window.addEventListener("hashchange", focus);
    return () => window.removeEventListener("hashchange", focus);
  }, []);
  return null;
}
