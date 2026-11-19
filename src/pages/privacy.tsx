import { sitePath } from "@/concept/site/language";
import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { useSiteCopy } from "@/concept/site/copy";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

const SECTIONS = ["waitlist", "demo", "cookies", "rights"] as const;

// A short, honest privacy note for the pre-launch sites. Not a full policy.
export default function Privacy({ links, analyticsEnabled, origin }: SiteProps) {
  const { site, locale } = useSiteCopy();
  const home = locale === "sv" ? sitePath(locale) : links.apex;
  return (
    <div className={s.page}>
      <SiteHead page="privacy" productOrigin={origin} title={site["privacy.title"]} description={site["privacy.intro"]} />
      <header className={s.masthead}>
        <a className={s.home} href={home}>
          <Wordmark className={s.wordmark} label={site["landing.home"]} />
        </a>
      </header>
      <main className={s.prose}>
        <h1>{site["privacy.heading"]}</h1>
        <p>{site["privacy.intro"]}</p>
        {SECTIONS.map((section) => (
          <section key={section}>
            <h2>{site[`privacy.${section}.heading`]}</h2>
            <p>{section === "cookies" && analyticsEnabled ? site["privacy.analytics.body"] : site[`privacy.${section}.body`]}</p>
          </section>
        ))}
      </main>
      <footer className={`${s.footer} ${s.landingFooter}`}>
        <a href={home}>{site["privacy.back"]}</a>
      </footer>
    </div>
  );
}
