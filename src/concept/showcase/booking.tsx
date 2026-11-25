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
import { kronor, menuOf, minutes, PACK_MENU, SALON, SHOWCASE_SLUG, telHref } from "./salon";
import p from "./picker.module.css";

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

const BookingContext = createContext<{
  preset: Preset;
  book: (serviceId?: string) => void;
  menuAnchor: string;
}>({ preset: { count: 0 }, book: () => {}, menuAnchor: "behandlingar" });

export const useBook = () => useContext(BookingContext).book;
export const useBookingPreset = () => useContext(BookingContext).preset;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/** Lets any "Boka" on the page start the booking below, with a treatment already chosen when it came from the price list. */
export function ShowcaseBookingProvider({ children, anchor = "boka", menuAnchor = "behandlingar" }: { children: ReactNode; anchor?: string; menuAnchor?: string }) {
  const [preset, setPreset] = useState<Preset>({ count: 0 });
  const book = useCallback((serviceId?: string) => {
    if (serviceId) {
      setPreset((current) => ({ serviceId, count: current.count + 1 }));
      scrollToId(anchor);
    } else {
      scrollToId(menuAnchor);
    }
  }, [anchor, menuAnchor]);
  const value = useMemo(() => ({ preset, book, menuAnchor }), [preset, book, menuAnchor]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

function TreatmentPicker({ onPick }: { onPick: (serviceId: string) => void }) {
  const menu = useShowcaseMenu();
  return (
    <div className={p.root}>
      <p className={p.lead}>Välj en behandling så visar vi första lediga tid.</p>
      {menu.map((group) => (
        <div key={group.category}>
          <ul className={p.list}>
            {group.items.map((item) => (
              <li key={item.id}>
                <button type="button" className={p.item} onClick={() => onPick(item.id)}>
                  <span className={p.row}>
                    <span className={p.name}>{item.name}</span>
                    <span className={p.cue}>Boka</span>
                  </span>
                  <span className={p.meta}>{minutes(item.duration)} · {kronor(item.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Flow({ listTreatments }: { listTreatments: boolean }) {
  const state = useShowcaseState();
  const now = useSalonNow();
  const { preset, book, menuAnchor } = useContext(BookingContext);
  const [receipt, setReceipt] = useState<string>();
  if (state === null) {
    return (
      <p className="py-8">
        Bokningen går inte att öppna just nu. Ring oss på <a className="font-medium text-action underline" href={telHref()}>{SALON.phone}</a> så hjälper vi dig.
      </p>
    );
  }
  if (receipt) return <ConceptLanguage language="sv" currency="SEK"><Confirmation id={receipt} onBack={() => setReceipt(undefined)} /></ConceptLanguage>;
  const initial = state && state.services.some((service) => service.id === preset.serviceId) ? preset.serviceId : undefined;
  if (!preset.serviceId || (state && !initial)) {
    if (listTreatments) return <TreatmentPicker onPick={book} />;
    return (
      <p className={p.lead}>
        Välj en behandling i listan så visar vi första lediga tid.{" "}
        <a className={p.link} href={`#${menuAnchor}`}>Till behandlingarna</a>
      </p>
    );
  }
  if (!state || !initial) return <p role="status" className="py-8 text-text-secondary">Hämtar lediga tider …</p>;
  return (
    <ConceptLanguage language="sv" currency="SEK">
      <BookingWizard key={preset.count} state={state} now={now} initialServiceId={initial} onBooked={setReceipt} />
    </ConceptLanguage>
  );
}

/**
 * The booking flow in the site's colours. The palette becomes the booking page's tokens through the same
 * theme code the salon's own booking page uses; the site's two typefaces replace the booking page's.
 * On a homepage the wizard waits until a treatment is chosen, so the page is not a second empty search.
 * On the standalone booking page, `listTreatments` shows the price list here instead.
 */
export function ShowcaseBooking({ palette, corners, className, listTreatments = false }: { palette: Palette; corners: CornerStyle; className?: string; listTreatments?: boolean }) {
  const { className: themed, style, ...attributes } = themeAttributes({ ...DEFAULT_THEME, colors: palette, corners });
  const fonts = { "--page-font-heading": "var(--display)", "--page-font-body": "var(--body)" } as CSSProperties;
  return (
    <div className={cx("studio-root", themed, className)} {...attributes} style={{ ...style, ...fonts }}>
      <div data-booking-flow>
        <Flow listTreatments={listTreatments} />
      </div>
      <ConceptLanguage language="sv" currency="SEK">
        <Toaster />
      </ConceptLanguage>
    </div>
  );
}
