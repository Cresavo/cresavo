import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

// The product domain's one screen: who it is for, one way into the demo, and the launch waiting list.
export default function ComingSoon({ links, waitlist }: SiteProps) {
  return (
    <div className={s.page}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} />
      <header className={s.masthead}>
        <Wordmark className={s.wordmark} />
      </header>
      <main className={s.soonMain}>
        <h1 className={s.promise}>
          <span>{site["promise.first"]}</span>
          <span>{site["promise.second"]}</span>
        </h1>
        <p className={s.intro}>{site["soon.body"]}</p>
        <a className={s.primary} href={links.demo}>{site["soon.demo"]}</a>
        <WaitlistForm from="/coming-soon" initial={waitlist ?? undefined} />
      </main>
      <footer className={s.footer}>{site["soon.footer"]}</footer>
    </div>
  );
}
