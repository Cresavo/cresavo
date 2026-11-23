import { PROJECT_REPOSITORY } from "../brand";
import { Wordmark } from "../ui/wordmark";
import { useSiteCopy } from "./copy";
import { sitePath } from "./language";
import l from "./landing.module.css";

/** The plum masthead shared by the homepage and the about page. On the homepage the section links are anchors. */
export function SiteTopbar({ home }: { home: boolean }) {
  const { site, locale } = useSiteCopy();
  const homePath = sitePath(locale);
  const section = (id: string) => (home ? `#${id}` : `${homePath}#${id}`);
  const otherLocale = locale === "sv" ? "en" : "sv";
  return (
    <div className={l.topbar}>
      <a href={home ? "#top" : homePath} aria-label={site["landing.home"]}>
        <Wordmark inverse className={l.wordmark} label="" />
      </a>
      <nav aria-label={site["soon.nav"]}>
        <a className={l.wide} href={section("how")}>{site["nav.how"]}</a>
        <a href={section("pricing")}>{site["nav.pricing"]}</a>
        <a className={l.wide} href={section("questions")}>{site["nav.faq"]}</a>
        <a href={sitePath(locale, "about")} aria-current={home ? undefined : "page"}>{site["nav.about"]}</a>
        <a href={home ? sitePath(otherLocale) : sitePath(otherLocale, "about")} lang={otherLocale} hrefLang={otherLocale}>{site["language.switch"]}</a>
      </nav>
    </div>
  );
}

export function SiteFooter() {
  const { site, locale } = useSiteCopy();
  const otherLocale = locale === "sv" ? "en" : "sv";
  return (
    <footer className={l.footer}>
      <div className={l.wrap}>
        <span>{site["soon.footer"]}</span>
        <nav aria-label={site["footer.nav"]}>
          <a href={sitePath(locale, "about")}>{site["nav.about"]}</a>
          <a href={sitePath(locale, "privacy")}>{site["waitlist.privacy"]}</a>
          <a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a>
          <a href={sitePath(otherLocale)} lang={otherLocale} hrefLang={otherLocale}>{site["language.switch"]}</a>
        </nav>
      </div>
    </footer>
  );
}
