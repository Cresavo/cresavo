"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share, SquarePlus } from "lucide-react";
import { t } from "../i18n";
import { isAppleTouch } from "../studio/install/install";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";
import { usePage } from "./page-context";

/**
 * What a home-screen shortcut takes from the page once the customer asks for one: the business's name as its label
 * and the business's logo as its picture (without a logo, the route's neutral icon stays). Never the platform's.
 * Returns how to put the page back. The page carries no web app manifest, here or before: the route keeps its
 * default, and the shortcut is the browser's own, made from its menu.
 */
export function wearSalonHome(doc: Document, name: string, logo: string | null): () => void {
  const title = doc.title;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]') ?? Object.assign(doc.createElement("meta"), { name: "apple-mobile-web-app-title" });
  const addedMeta = !meta.isConnected;
  const label = meta.content;
  const icon = doc.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  const picture = icon?.getAttribute("href") ?? null;
  doc.title = name;
  meta.content = name;
  if (addedMeta) doc.head.append(meta);
  if (icon && logo) icon.href = logo;
  return () => {
    // The shell sets the title again on its next navigation; until then it goes back to what it was.
    if (doc.title === name) doc.title = title;
    if (addedMeta) meta.remove();
    else meta.content = label;
    if (icon && picture !== null) icon.setAttribute("href", picture);
  };
}

const noSubscription = () => () => {};

/** A phone or tablet showing the page in its browser, not already from the home screen. */
function useOffersHome(): boolean {
  return useSyncExternalStore(noSubscription, () =>
    window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(display-mode: standalone)").matches, () => false);
}

/**
 * A quiet row under Find us for a returning customer: add this business's page to the home screen. Nothing changes
 * until the customer taps it; then the page wears the business's name and logo for the rest of the visit, and the sheet says where the browser
 * keeps the choice (Safari's Share menu, or the browser's own menu).
 */
export function SalonHomeRow({ name }: { name: string }) {
  const page = usePage();
  const offers = useOffersHome();
  const [open, setOpen] = useState(false);
  // Asked for once, the page keeps the business's name and logo for the rest of the visit: the browser's menu is
  // usually opened after the sheet has closed.
  const [chosen, setChosen] = useState(false);
  const logo = page.theme.logo ?? null;
  useEffect(() => (chosen ? wearSalonHome(document, name, logo) : undefined), [chosen, name, logo]);
  if (!offers) return null;
  const apple = isAppleTouch(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  return (
    <div>
      <Button variant="link" align="start" icon={<SquarePlus aria-hidden size={16} className="shrink-0 text-text-secondary" />} className="min-h-12 w-full gap-3" onClick={() => { setChosen(true); setOpen(true); }}>
        <span className="text-meta">{t("booking.home.title")}</span>
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("booking.home.title")} description={t("booking.home.text", { salon: name })}>
        <p className="flex items-start gap-2 text-body">
          {apple && <Share size={18} aria-hidden className="mt-1 shrink-0 text-text-secondary" />}
          <span>{t(apple ? "booking.home.ios" : "booking.home.other")}</span>
        </p>
      </Sheet>
    </div>
  );
}
