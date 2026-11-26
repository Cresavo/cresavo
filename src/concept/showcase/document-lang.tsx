"use client";

import { useEffect } from "react";

/** The root layout speaks the platform language; these pages are the salon's, in Swedish. */
export function SwedishDocument() {
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.lang;
    html.lang = "sv";
    return () => { html.lang = previous; };
  }, []);
  return null;
}
