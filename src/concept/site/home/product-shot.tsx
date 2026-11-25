import { useSiteCopy } from "../copy";
import h from "./home.module.css";

/** One screenshot file under public/site/landing, at its pixel size. */
type Source = { file: string; width: number; height: number };

export type Shot = {
  /** Shown from 600 px: the desktop screen. */
  wide: Source;
  /** Shown on phones: the same moment taken at 390 px, never the desktop shot squeezed. */
  narrow: Source;
  /** Light and dark files exist. The booking page has one look, so it has none. */
  themed: boolean;
};

const WIDE = "(min-width: 600px)";
const THEMES = ["light", "dark"] as const;

function url(locale: string, { file }: Source, theme?: string) {
  return `/site/landing/${locale}-${file}${theme ? `-${theme}` : ""}.webp`;
}

/**
 * A real screenshot of the demo in the page's language. A themed shot renders a light and a dark picture
 * and CSS shows the one matching the page (the system's scheme, or the visitor's pinned choice), so the
 * first paint never shows the wrong theme. Lazy unless `eager`: a hidden lazy picture is never fetched.
 */
export function ProductShot({ shot, label, eager = false, className }: { shot: Shot; label: string; eager?: boolean; className?: string }) {
  const { locale } = useSiteCopy();
  const themes = shot.themed ? THEMES : [undefined];
  return (
    <figure className={`${h.shot} ${className ?? ""}`} aria-label={label}>
      {themes.map((theme) => (
        <picture key={theme ?? "one"} className={theme === "light" ? h.shotLight : theme === "dark" ? h.shotDark : undefined}>
          <source media={WIDE} srcSet={url(locale, shot.wide, theme)} width={shot.wide.width} height={shot.wide.height} />
          {/* A plain img: art direction needs <picture>, and the files are already sized and compressed. */}
          <img src={url(locale, shot.narrow, theme)} width={shot.narrow.width} height={shot.narrow.height} alt={label}
            loading={eager ? "eager" : "lazy"} decoding="async" />
        </picture>
      ))}
    </figure>
  );
}
