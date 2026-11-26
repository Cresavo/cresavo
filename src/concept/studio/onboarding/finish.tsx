"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { CalendarCheck, Palette, Upload } from "lucide-react";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { ButtonLink, buttonClass } from "../../ui/button";
import { ListRow } from "../../ui/list-row";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { recordPageSeen } from "./checklist";

/**
 * The finished salon: its real booking page to try as a customer would, one way on (the day) and a few things that
 * can wait. The salon lives in this browser, so nothing here offers its address for others to open; sharing stays
 * with Settings › Booking link, which says so.
 */
export function SetupFinish({ progress, titleRef }: { progress: ReactNode; titleRef: Ref<HTMLHeadingElement> }) {
  const { state } = useStudio();
  const { slug } = state.salon;
  const home = bookingHome(slug);
  // Opening the page from here counts as having checked it.
  const seen = () => recordPageSeen(slug);
  // One frame: under the title on a phone, beside everything from lg. The column is `contents` until then, so its
  // children and the frame share one flow and `order` places the frame.
  return <div className="flex flex-col gap-6 lg:mx-auto lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-12">
    <div className="contents lg:block lg:space-y-6">
      <div className="order-1">{progress}</div>
      <div className="order-2 -mb-6"><PageHeader tools={false} titleRef={titleRef} title={t("setup.ready")} subtitle={t("setup.readyHint")} /></div>
      <div className="order-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={home + "#book"} onClick={seen} className={buttonClass("secondary", "md", "w-full sm:w-fit")}>
          <CalendarCheck aria-hidden size={18} />{t("setup.testBooking")}
        </Link>
        <Link href={home} onClick={seen} className={buttonClass("link", "md", "-ml-1 px-1")}>{t("setup.seePage")}</Link>
      </div>
      <div className="order-5"><ButtonLink href="/studio" size="lg" width="responsive">{t("setup.goToDay")}</ButtonLink></div>
      <section aria-labelledby="setup-later" className="order-6 space-y-1 pt-2">
        <h2 id="setup-later" className="text-h3 font-semibold">{t("setup.later")}</h2>
        <ul className="-mx-4">
          <li><ListRow href="/studio/customers/import" leading={<Upload aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.import")} meta={t("setup.next.importHint")} /></li>
          <li><ListRow href="/studio/more/booking-page" leading={<Palette aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.page")} meta={t("setup.next.pageHint")} /></li>
        </ul>
      </section>
    </div>
    <SetupPreview src={home} title={t("setup.previewTitle")} />
  </div>;
}


/** Treatment rows in the booking page (the divided list under each category). */
const TREATMENT_ROW = 'section[id^="treatments-"] .divide-y > div';

/**
 * Height of the booking page's own blocks. The shell is `min-h-dvh` with a `flex-1` main, so
 * `scrollHeight` follows the iframe and cannot shrink; the main's children still can.
 */
function contentHeight(doc: Document): number {
  const main = doc.querySelector("main");
  const root = main?.parentElement ?? doc.body;
  if (!root) return 0;
  let height = 0;
  for (const child of root.children) {
    if (child.tagName === "STYLE") continue;
    height += child === main ? innerHeight(main) : child.getBoundingClientRect().height;
  }
  return Math.ceil(height);
}

function innerHeight(el: Element): number {
  const kids = [...el.children];
  if (!kids.length) return 0;
  const top = Math.min(...kids.map(child => child.getBoundingClientRect().top));
  const bottom = Math.max(...kids.map(child => child.getBoundingClientRect().bottom));
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  const pad = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) : 0;
  const border = style ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0) : 0;
  return Math.max(0, bottom - top) + pad + border;
}

/** Prefer the full page; if a cap would cut a row, end at the last complete edge that fits. */
function heightThatEndsCleanly(doc: Document, content: number, cap: number): number {
  if (content <= cap) return content;
  const scrollY = doc.defaultView?.scrollY ?? 0;
  const rows = [...doc.querySelectorAll(TREATMENT_ROW)];
  let bottom = 0;
  for (const row of rows) {
    const rowBottom = row.getBoundingClientRect().bottom + scrollY;
    if (rowBottom <= cap) bottom = rowBottom;
    else break;
  }
  if (bottom > 0) return Math.min(cap, Math.ceil(bottom));
  // The cap falls inside the first row: end at its top so the row is not split.
  const firstTop = rows[0] ? rows[0].getBoundingClientRect().top + scrollY : 0;
  if (firstTop > 0 && firstTop <= cap) return Math.ceil(firstTop);
  return cap;
}

/**
 * On a narrow screen the frame grows with the booking page, so a treatment row is never cut through.
 * From lg the sticky side column is capped to the viewport and ends on a complete row.
 */
function SetupPreview({ src, title }: { src: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    let observer: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;

    const measure = () => {
      try {
        const doc = node.contentDocument;
        if (!doc?.documentElement) return;
        const content = contentHeight(doc);
        if (content <= 0) return;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const cap = window.matchMedia("(min-width: 64rem)").matches
          ? Math.floor(Math.min(44 * rem, window.innerHeight - 8 * rem))
          : null;
        setHeight(cap ? heightThatEndsCleanly(doc, content, cap) : content);
      } catch { /* Cross-origin: the CSS fallback height stays. */ }
    };

    const onLoad = () => {
      measure();
      try {
        const doc = node.contentDocument;
        if (!doc?.documentElement) return;
        observer?.disconnect();
        mutations?.disconnect();
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(measure);
          const watch = () => {
            const main = doc.querySelector("main");
            for (const el of [doc.documentElement, doc.body, main, ...(main ? [...main.children] : [])]) {
              if (el) observer!.observe(el);
            }
          };
          watch();
          const main = doc.querySelector("main");
          if (main && typeof MutationObserver !== "undefined") {
            mutations = new MutationObserver(() => { watch(); measure(); });
            mutations.observe(main, { childList: true, subtree: true });
          }
        }
      } catch { /* Same as measure. */ }
    };

    node.addEventListener("load", onLoad);
    if (node.contentDocument?.readyState === "complete") onLoad();
    window.addEventListener("resize", measure);
    return () => {
      node.removeEventListener("load", onLoad);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [src]);

  const style = height ? { "--setup-preview-height": `${height}px` } as CSSProperties : undefined;
  return <iframe ref={frame} src={src} title={title} style={style}
    className="setup-preview order-3 block w-full overflow-hidden rounded-lg bg-surface ring-1 ring-hairline lg:sticky lg:top-8" />;
}
