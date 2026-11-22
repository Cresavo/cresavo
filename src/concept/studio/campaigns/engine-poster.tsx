"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import type { CampaignPoster, PosterFormat } from "../../data/types";
import { engineRequest, fetchPosterSvg, uniqueIds, type EngineContext } from "../../campaigns/poster-engine/client";
import { POSTER_FORMATS } from "../../campaigns/poster-layout";
import { t } from "../../i18n";

interface EnginePosterProps {
  poster: CampaignPoster;
  format: PosterFormat;
  kicker: string;
  context: EngineContext;
  label: string;
  ref?: Ref<SVGSVGElement>;
}

function assign(ref: Ref<SVGSVGElement> | undefined, value: SVGSVGElement | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * A poster drawn by the server engine. The SVG is parsed as SVG (never as HTML)
 * and only its <svg> root is kept, so the shared PNG export works on it unchanged.
 */
export function EnginePoster({ poster, format, kicker, context, label, ref }: EnginePosterProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const request = JSON.stringify({ poster, format, kicker, context });

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const markup = uniqueIds(await fetchPosterSvg(await engineRequest(poster, format, kicker, context)));
        const root = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
        if (!live || !holder.current || root.nodeName !== "svg" || root.querySelector("script, foreignObject")) return;
        const svg = document.importNode(root, true) as unknown as SVGSVGElement;
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "auto";
        holder.current.replaceChildren(svg);
        assign(ref, svg);
        setState("ready");
      } catch {
        if (live) setState("failed");
      }
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // The request string carries every input; the objects themselves change identity on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => () => assign(ref, null), [ref]);

  const { width, height } = POSTER_FORMATS[format];
  return (
    <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
      <div ref={holder} className="h-full w-full" />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-3 text-center text-meta text-text-secondary" role={state === "failed" ? "alert" : "status"}>
          {t(state === "failed" ? "campaigns.engine.failed" : "campaigns.engine.loading")}
        </div>
      )}
    </div>
  );
}
