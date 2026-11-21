import { useSiteCopy } from "./copy";
import { sitePath } from "./language";
import type { SiteProps } from "./links";
import { PROJECT_REPOSITORY } from "../brand";
import { SiteFooter, SiteTopbar } from "./site-chrome";
import { SiteHead } from "./site-head";
import l from "./landing.module.css";

const BEATS = ["home", "locked", "possible", "built", "shared"] as const;

/** Why the product exists, told by its founder in five short beats. */
export function AboutPage({ origin }: SiteProps) {
  const { site, locale } = useSiteCopy();
  return (
    <div className={l.page}>
      <SiteHead page="about" title={site["about.title"]} description={site["about.description"]} productOrigin={origin} />
      <a className={l.skip} href="#main">{site["skip"]}</a>
      <header className={`${l.hero} ${l.aboutHero} ${l.onPlum}`}>
        <div className={l.wrap}>
          <SiteTopbar home={false} />
          <div className={l.heroCopy}>
            <h1>{site["about.heading"]}</h1>
            <p className={l.lead}>{site["about.lead"]}</p>
          </div>
        </div>
      </header>
      <main id="main" className={`${l.story} ${l.onPlum}`}>
        <div className={l.wrap}>
          <div className={l.beats}>
            {BEATS.map((beat) => (
              <section className={l.beat} key={beat} aria-labelledby={`beat-${beat}`}>
                <h2 id={`beat-${beat}`}>{site[`about.${beat}`]}</h2>
                <p>{site[`about.${beat}.text`]}</p>
              </section>
            ))}
          </div>
          <p className={l.signature}>{site["about.signature"]}</p>
          <div className={l.inlineCta}>
            <a className={`${l.btn} ${l.apricot}`} href={`${PROJECT_REPOSITORY}/discussions`}>{site["about.talk"]}</a>
            <a className={`${l.btn} ${l.ghostCream}`} href={sitePath(locale)}>{site["about.back"]}</a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
