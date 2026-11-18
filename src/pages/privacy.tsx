import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

const SECTIONS = ["waitlist", "demo", "cookies"] as const;

// A short, honest privacy note for the pre-launch sites. Not a full policy.
export default function Privacy({ links }: SiteProps) {
  return (
    <div className={s.page}>
      <SiteHead title={site["privacy.title"]} description={site["privacy.intro"]} />
      <header className={s.masthead}>
        <a className={s.home} href={links.apex}>
          <Wordmark className={s.wordmark} label={site["landing.home"]} />
        </a>
      </header>
      <main className={s.prose}>
        <h1>{site["privacy.heading"]}</h1>
        <p>{site["privacy.intro"]}</p>
        {SECTIONS.map((section) => (
          <section key={section}>
            <h2>{site[`privacy.${section}.heading`]}</h2>
            <p>{site[`privacy.${section}.body`]}</p>
          </section>
        ))}
      </main>
      <footer className={`${s.footer} ${s.landingFooter}`}>
        <a href={links.apex}>{site["privacy.back"]}</a>
      </footer>
    </div>
  );
}
