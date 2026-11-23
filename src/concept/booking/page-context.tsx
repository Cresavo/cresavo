"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PAGE, normalizePage, type PageConfig } from "../page/config";
import { applyTemplate, isTemplateId } from "../page/templates";
import { useServerSalon } from "../server-salon";
import { usePublicDemo } from "../store";

// The page config the booking pages draw from: the business's saved one, or,
// inside the editor's preview frame, the draft the editor sends. A draft is
// accepted only from the same origin's parent window and is normalised like
// any stored config. `?design=<template>` shows the page in one of the
// ready-made designs without saving anything: the link the product site and
// the editor use to show what a design looks like.

export const DESIGN_PARAM = "design";

export const DRAFT_MESSAGE = "page-draft";
export const READY_MESSAGE = "page-preview-ready";

const PageContext = createContext<PageConfig>(DEFAULT_PAGE);

export const usePage = () => useContext(PageContext);

function isPreviewFrame() {
  return window.parent !== window && new URLSearchParams(window.location.search).get("preview") === "1";
}

export function PageProvider({ children }: { children: ReactNode }) {
  const state = usePublicDemo();
  // The server's salon carries only what its saved layout shows (reviews, for one), so a draft layout cannot be previewed on it.
  const fromServer = useServerSalon() !== null;
  const [draft, setDraft] = useState<PageConfig>();
  useEffect(() => {
    if (fromServer || !isPreviewFrame()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === DRAFT_MESSAGE) setDraft(normalizePage(event.data.page));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [fromServer]);
  const design = useSearchParams()?.get(DESIGN_PARAM);
  const saved = state?.page ?? DEFAULT_PAGE;
  // The server's salon carries only what its saved layout shows and its CSS already scoped, so a design is not previewed on it either.
  const shown = useMemo(() => (!fromServer && isTemplateId(design) ? applyTemplate(saved, design) : saved), [fromServer, design, saved]);
  return <PageContext.Provider value={(!fromServer && draft) || shown}>{children}</PageContext.Provider>;
}
