import { useEffect, useRef, useState } from "react";
import { Wordmark } from "../../ui/wordmark";
import { useSiteCopy } from "../copy";
import { sitePath } from "../language";
import { Icon } from "./icons";
import h from "./home.module.css";

export const SECTIONS = [
  { id: "how", label: "home.nav.product" },
  { id: "open", label: "home.nav.open" },
  { id: "pricing", label: "nav.pricing" },
  { id: "questions", label: "nav.faq" },
] as const;

/**
 * The sticky top bar: section links, the other language and the demo on wide screens,
 * a small sheet menu on phones, and the light/dark toggle. It gains a rule once the page moves.
 */
export function HomeHeader({ demo, theme, onTheme }: { demo: string; theme: string; onTheme: () => void }) {
  const { site, locale } = useSiteCopy();
  const other = locale === "sv" ? "en" : "sv";
  const bar = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setSolid(scrollY > 8);
    sync();
    addEventListener("scroll", sync, { passive: true });
    return () => removeEventListener("scroll", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector("a")?.focus();
    const close = (back: boolean) => { setOpen(false); if (back) menuBtn.current?.focus(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    const click = (e: MouseEvent) => { if (!bar.current?.contains(e.target as Node)) close(false); };
    const focus = (e: FocusEvent) => { if (e.relatedTarget && !bar.current?.contains(e.relatedTarget as Node)) close(false); };
    const desk = matchMedia("(min-width: 860px)");
    const wide = () => { if (desk.matches) close(false); };
    const header = bar.current;
    document.addEventListener("keydown", key);
    document.addEventListener("click", click);
    header?.addEventListener("focusout", focus);
    desk.addEventListener("change", wide);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("click", click);
      header?.removeEventListener("focusout", focus);
      desk.removeEventListener("change", wide);
    };
  }, [open]);

  const lang = { href: sitePath(other), lang: other, hrefLang: other };
  return (
    <header ref={bar} className={h.header} data-solid={solid ? "" : undefined} data-open={open ? "" : undefined}>
      <div className={`${h.wrap} ${h.headerIn}`}>
        <a className={h.brand} href="#top" aria-label={site["home.top"]}><Wordmark label="" /></a>
        <nav className={h.nav} aria-label={site["home.nav"]}>
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{site[s.label]}</a>)}
        </nav>
        <a className={h.navLang} {...lang}>{site["home.lang"]}</a>
        <a className={`${h.btn} ${h.btnPlum} ${h.navCta}`} href={demo}>{site["home.demo"]}</a>
        <button ref={menuBtn} className={h.menuBtn} type="button" aria-expanded={open} aria-controls="home-menu" onClick={() => setOpen(!open)}>{site["home.menu"]}</button>
        <button className={h.themeBtn} type="button" aria-label={site["home.theme"]} aria-pressed={theme === "dark"} onClick={onTheme}>
          <Icon name="moon" className={`${h.ic} ${h.moon}`} />
          <Icon name="sun" className={`${h.ic} ${h.sun}`} />
        </button>
      </div>
      <nav ref={sheet} className={h.msheet} id="home-menu" aria-label={site["home.nav.sections"]} hidden={!open} onClick={(e) => { if ((e.target as Element).closest("a")) setOpen(false); }}>
        <ul className={h.wrap}>
          {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{site[s.label]}</a></li>)}
          <li><a {...lang}>{site["home.lang"]}</a></li>
          <li className={h.msCta}><a className={`${h.btn} ${h.btnPlum}`} href={demo}>{site["home.demo"]} <Icon name="arrow" className={h.ic} /></a></li>
        </ul>
      </nav>
    </header>
  );
}
