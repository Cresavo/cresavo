"use client";

import type { Palette } from "../page/colour";
import type { CornerStyle } from "../page/theme";
import { ShowcaseBooking } from "./booking";
import { useShowcaseTheme, type ShowcaseTheme } from "./chrome";
import { ADDRESS } from "./content";
import { SALON, telHref } from "./salon";
import { ThemeIcon } from "./theme-icon";

/** A site's stylesheet: root, skip, header, wrap, headerIn, name, back, icon, standalone, standaloneIn, standaloneHead, h2, flow, footer, footerIn. */
type Styles = Readonly<Record<string, string>>;

/**
 * The salon's booking on a page of its own, without the homepage around it: what a salon links to from
 * anywhere (a social profile, an email, a QR code at the till). Same flow, same colours as its site.
 */
export function StandaloneBooking({ styles: s, home, themeKey, initialTheme, palette, corners }: {
  styles: Styles;
  home: string;
  themeKey: string;
  initialTheme: ShowcaseTheme;
  palette: Record<ShowcaseTheme, Palette>;
  corners: CornerStyle;
}) {
  const { theme, toggle } = useShowcaseTheme(themeKey, initialTheme);
  return (
    <div className={s.root} data-theme={theme}>
      <a className={s.skip} href="#boka">Hoppa till bokningen</a>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerIn}`}>
          <a className={s.name} href={home}>{SALON.name}</a>
          <a className={s.back} href={home}>Till startsidan</a>
          <button type="button" className={s.icon} aria-label="Mörkt läge" aria-pressed={theme === "dark"} onClick={toggle}>
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </header>
      <main id="boka" className={s.standalone}>
        <div className={`${s.wrap} ${s.standaloneIn}`}>
          <div className={s.standaloneHead}>
            <h1 className={s.h2}>Boka tid</h1>
            <p>{ADDRESS.street}, {ADDRESS.area} · <a href={telHref()}>{SALON.phone}</a></p>
          </div>
          <ShowcaseBooking className={s.flow} palette={palette[theme]} corners={corners} />
        </div>
      </main>
      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerIn}`}>
          <span>{SALON.name}</span>
          <span>{ADDRESS.street}, {ADDRESS.city}</span>
        </div>
      </footer>
    </div>
  );
}
