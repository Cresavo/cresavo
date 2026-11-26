"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ShowcaseConfirmation } from "./confirmation";
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
import { hoursThisWeek, kronor, lunchLine, menuOf, minutes, openingHours, PACK_MENU, SALON, SHOWCASE_SLUG, telHref } from "./salon";
import p from "./picker.module.css";

// The demo salon's own booking engine on a showcase site: the same wizard and
// deposit checkout as the demo salon, in Swedish, wearing
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

/**
 * This week's opening hours and the lunch break from the live demo, so a one-off opening or a closed day the
 * booking knows about is on the site too. Before the demo is read, the salon's usual week.
 */
export function useShowcaseHours() {
  const state = useShowcaseState();
  const { today } = useSalonNow();
  return useMemo(
    () => (state ? { lines: openingHours(hoursThisWeek(state.salon, today)), lunch: lunchLine(state.salon) } : { lines: openingHours(), lunch: lunchLine() }),
    [state, today],
  );
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

function Flow({ listTreatments, sharePath }: { listTreatments: boolean; sharePath: string }) {
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
  if (receipt) {
    return (
      <ConceptLanguage language="sv" currency="SEK">
        <ShowcaseConfirmation
          id={receipt}
          sharePath={sharePath}
          onBack={() => setReceipt(undefined)}
          onOpen={setReceipt}
          onBookAgain={(serviceId) => { setReceipt(undefined); book(serviceId); }}
        />
      </ConceptLanguage>
    );
  }
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
 * Keeps what the booking focuses clear of a site header that stays on screen: a step's heading takes focus when
 * the step opens, and without this it can sit under the header.
 */
function clearStickyHeader(target: Element) {
  requestAnimationFrame(() => {
    const header = document.querySelector("header");
    if (!header || getComputedStyle(header).position !== "sticky") return;
    const covered = header.getBoundingClientRect().bottom + 16 - target.getBoundingClientRect().top;
    if (covered > 0) window.scrollBy({ top: -covered, behavior: "auto" });
  });
}

/**
 * The booking flow in the site's colours. The palette becomes the booking page's tokens through the same
 * theme code the salon's own booking page uses; the site's two typefaces replace the booking page's.
 * On a homepage the wizard waits until a treatment is chosen, so the page is not a second empty search.
 * On the standalone booking page, `listTreatments` shows the price list here instead.
 */
export function ShowcaseBooking({ palette, corners, className, listTreatments = false, sharePath }: { palette: Palette; corners: CornerStyle; className?: string; listTreatments?: boolean; sharePath: string }) {
  const { className: themed, style, ...attributes } = themeAttributes({ ...DEFAULT_THEME, colors: palette, corners });
  const fonts = { "--page-font-heading": "var(--display)", "--page-font-body": "var(--body)" } as CSSProperties;
  return (
    <div className={cx("studio-root", themed, className)} {...attributes} style={{ ...style, ...fonts }}>
      <div data-booking-flow onFocus={(event) => clearStickyHeader(event.target)}>
        <Flow listTreatments={listTreatments} sharePath={sharePath} />
      </div>
      <ConceptLanguage language="sv" currency="SEK">
        <Toaster />
      </ConceptLanguage>
    </div>
  );
}
