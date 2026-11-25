"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Confirmation } from "../booking/confirmation";
import { themeAttributes } from "../booking/page-root";
import { BookingWizard } from "../booking/wizard";
import type { DemoState } from "../data/types";
import { ConceptLanguage } from "../i18n/boundary";
import type { Palette } from "../page/colour";
import { DEFAULT_THEME, type CornerStyle } from "../page/theme";
import { openBookingWorkspace, usePublicDemo } from "../store";
import { cx } from "../ui/cx";
import { Toaster } from "../ui/toast";
import { useSalonNow } from "../use-now";
import { menuOf, PACK_MENU, SALON, SHOWCASE_SLUG, telHref } from "./salon";

// The demo salon's own booking engine on a showcase site: the same wizard,
// deposit checkout and confirmation as /boka/salong-eko, in Swedish, wearing
// the site's colours and type. Nothing here decides a booking rule.

/** The demo salon from this browser's demo, or null while it loads or when the visitor's demo holds another business. */
function useShowcaseState(): DemoState | null | undefined {
  const state = usePublicDemo();
  useEffect(() => { openBookingWorkspace(SHOWCASE_SLUG); }, []);
  if (!state) return undefined;
  return state.salon.slug === SHOWCASE_SLUG ? state : null;
}

/** The price list from the live demo once it is read, so a change made in the studio shows here too. */
export function useShowcaseMenu() {
  const state = useShowcaseState();
  return useMemo(() => (state ? menuOf(state.services) : PACK_MENU), [state]);
}

interface Preset { serviceId?: string; count: number }

const BookingContext = createContext<{ preset: Preset; book: (serviceId?: string) => void }>({ preset: { count: 0 }, book: () => {} });

export const useBook = () => useContext(BookingContext).book;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lets any "Boka" on the page start the booking below, with a treatment already chosen when it came from the price list. */
export function ShowcaseBookingProvider({ children, anchor = "boka" }: { children: ReactNode; anchor?: string }) {
  const [preset, setPreset] = useState<Preset>({ count: 0 });
  const book = useCallback((serviceId?: string) => {
    setPreset((current) => ({ serviceId, count: current.count + 1 }));
    document.getElementById(anchor)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }, [anchor]);
  const value = useMemo(() => ({ preset, book }), [preset, book]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

function Flow() {
  const state = useShowcaseState();
  const now = useSalonNow();
  const { preset } = useContext(BookingContext);
  const [receipt, setReceipt] = useState<string>();
  if (state === undefined) return <p role="status" className="py-8 text-text-secondary">Hämtar lediga tider …</p>;
  if (state === null) {
    return (
      <p className="py-8">
        Bokningen går inte att öppna just nu. Ring oss på <a className="font-medium text-action underline" href={telHref()}>{SALON.phone}</a> så hjälper vi dig.
      </p>
    );
  }
  if (receipt) return <Confirmation id={receipt} onBack={() => setReceipt(undefined)} />;
  const initial = state.services.some((service) => service.id === preset.serviceId) ? preset.serviceId : undefined;
  return <BookingWizard key={preset.count} state={state} now={now} initialServiceId={initial} onBooked={setReceipt} />;
}

/**
 * The booking flow in the site's colours. The palette becomes the booking page's tokens through the same
 * theme code the salon's own booking page uses; the site's two typefaces replace the booking page's.
 */
export function ShowcaseBooking({ palette, corners, className }: { palette: Palette; corners: CornerStyle; className?: string }) {
  const { className: themed, style, ...attributes } = themeAttributes({ ...DEFAULT_THEME, colors: palette, corners });
  const fonts = { "--page-font-heading": "var(--display)", "--page-font-body": "var(--body)" } as CSSProperties;
  return (
    <div className={cx("studio-root", themed, className)} {...attributes} style={{ ...style, ...fonts }}>
      <ConceptLanguage language="sv" currency="SEK">
        <div data-booking-flow>
          <Flow />
        </div>
        <Toaster />
      </ConceptLanguage>
    </div>
  );
}
