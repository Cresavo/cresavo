"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_PAGE, normalizePage, type PageConfig } from "../page/config";
import { useDemo } from "../store";

// The page config the booking pages draw from: the business's saved one, or,
// inside the editor's preview frame, the draft the editor sends. A draft is
// accepted only from the same origin's parent window and is normalised like
// any stored config.

export const DRAFT_MESSAGE = "page-draft";
export const READY_MESSAGE = "page-preview-ready";

const PageContext = createContext<PageConfig>(DEFAULT_PAGE);

export const usePage = () => useContext(PageContext);

function isPreviewFrame() {
  return window.parent !== window && new URLSearchParams(window.location.search).get("preview") === "1";
}

export function PageProvider({ children }: { children: ReactNode }) {
  const state = useDemo();
  const [draft, setDraft] = useState<PageConfig>();
  useEffect(() => {
    if (!isPreviewFrame()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === DRAFT_MESSAGE) setDraft(normalizePage(event.data.page));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return <PageContext.Provider value={draft ?? state?.page ?? DEFAULT_PAGE}>{children}</PageContext.Provider>;
}
