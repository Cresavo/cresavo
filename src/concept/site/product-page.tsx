import { useEffect, useRef, useState, type RefObject } from "react";
import { PROJECT_REPOSITORY } from "../brand";
import { useSiteCopy } from "./copy";
import { sitePath } from "./language";
import type { ProductSiteProps } from "./links";
import { SiteFooter, SiteTopbar } from "./site-chrome";
import { SiteHead } from "./site-head";
import { WaitlistForm } from "./waitlist-form";
import l from "./landing.module.css";

type Key = keyof ReturnType<typeof useSiteCopy>["site"];

/** The ring screenshot is a dialog crop, so its height differs per language. */
const RING = { en: { width: 760, height: 1039 }, sv: { width: 760, height: 965 } } as const;

const list = (value: string) => value.split("|");

/** A screenshot of the demo studio in the page's language. The compressed files are served as they are. */
function Shot({ name, alt, width = 1400, height = 950, className = "", priority = false }: { name: string; alt: string; width?: number; height?: number; className?: string; priority?: boolean }) {
  const { locale } = useSiteCopy();
  return (
    <div className={`${l.shot} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/site/landing/${locale}-${name}.webp`} width={width} height={height} alt={alt}
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const, decoding: "async" as const })} />
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.31c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

function Hero({ demo, ctaRow }: { demo: string; ctaRow: RefObject<HTMLDivElement | null> }) {
  const { site } = useSiteCopy();
  return (
    <header id="top" className={`${l.hero} ${l.onPlum}`}>
      <div className={l.wrap}>
        <SiteTopbar home />
        <div className={l.heroCopy}>
          <h1>{site["hero.heading"]}</h1>
          <p className={l.lead}>{site["hero.lead"]}</p>
          <div className={l.ctaRow} ref={ctaRow}>
            <a className={`${l.btn} ${l.apricot}`} href={demo}>{site["soon.demo"]}</a>
            <a className={`${l.btn} ${l.ghostCream}`} href="#why">{site["nav.why"]}</a>
          </div>
          <p className={l.heroNote}>{site["hero.note"]}</p>
        </div>
        <a className={l.heroShot} href={demo} tabIndex={-1} aria-hidden>
          <Shot name="today" alt={site["hero.alt"]} priority />
        </a>
      </div>
    </header>
  );
}

const WORDS = [
  { key: "easy" },
  { key: "open", link: { label: "why.open.link", href: PROJECT_REPOSITORY } },
  { key: "zero" },
  { key: "future" },
  { key: "listen", link: { label: "why.listen.link", href: `${PROJECT_REPOSITORY}/discussions` } },
] as const;

function WhySwitch({ demo }: { demo: string }) {
  const { site, locale } = useSiteCopy();
  return (
    <section id="why" className={`${l.section} ${l.white} ${l.first}`} aria-labelledby="why-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="why-heading">{site["why.heading"]}</h2>
        <div className={l.words}>
          {WORDS.map((word) => (
            <div className={l.word} key={word.key}>
              <h3>{site[`why.${word.key}`]}</h3>
              <div>
                <p className={l.what}>{site[`why.${word.key}.what`]}</p>
                <p className={l.more}>
                  {site[`why.${word.key}.more`]}
                  {"link" in word && <> <a href={word.link.href}>{site[word.link.label]}</a></>}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className={l.inlineCta}>
          <a className={`${l.btn} ${l.plum}`} href={demo}>{site["soon.demo"]}</a>
          <a className={l.textLink} href={sitePath(locale, "about")}>{site["why.story"]}</a>
        </div>
      </div>
    </section>
  );
}

const MOMENTS = [
  { key: "ring", shot: "ring" },
  { key: "empty", shot: "calendar", note: true },
  { key: "yours", shot: "customer-card" },
] as const;

function Friday({ demo }: { demo: string }) {
  const { site, locale } = useSiteCopy();
  return (
    <section id="friday" className={`${l.section} ${l.cream}`} aria-labelledby="friday-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="friday-heading">{site["friday.heading"]}</h2>
        <p className={l.intro}>{site["friday.intro"]}</p>
        {MOMENTS.map((moment) => (
          <div className={l.job} key={moment.key}>
            <div>
              <p className={l.when}>{site[`friday.${moment.key}.when`]}</p>
              <h3>{site[`friday.${moment.key}`]}</h3>
              <p className={l.what}>{site[`friday.${moment.key}.what`]}</p>
              <p className={l.more}>{site[`friday.${moment.key}.more`]}</p>
              {"note" in moment && <p className={l.caption}>{site["friday.empty.note"]}</p>}
            </div>
            {moment.shot === "ring"
              ? <Shot name="ring" alt={site["friday.ring.alt"]} {...RING[locale]} className={l.ringShot} />
              : <Shot name={moment.shot} alt={site[`friday.${moment.key}.alt`]} />}
          </div>
        ))}
        <div className={l.inlineCta}>
          <a className={`${l.btn} ${l.plum}`} href={demo}>{site["soon.demo"]}</a>
          <span>{site["friday.cta"]}</span>
        </div>
      </div>
    </section>
  );
}

function Columns({ id, heading, groups, tone, three = false }: { id: string; heading: Key; groups: readonly Key[]; tone: string; three?: boolean }) {
  const { site } = useSiteCopy();
  return (
    <section id={id} className={`${l.section} ${tone}`} aria-labelledby={`${id}-heading`}>
      <div className={l.wrap}>
        <h2 className={l.title} id={`${id}-heading`}>{site[heading]}</h2>
        <div className={`${l.columns} ${three ? l.three : ""}`}>
          {groups.map((group) => (
            <div key={group}>
              <h3>{site[group]}</h3>
              <ul>{list(site[`${group}.items` as Key]).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClientsAi() {
  const { site } = useSiteCopy();
  const steps = ["ask", "suggest", "yes"] as const;
  return (
    <section id="next" className={`${l.section} ${l.onPlum}`} aria-labelledby="next-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="next-heading">{site["future.heading"]}</h2>
        <p className={l.intro}>{site["future.intro"]}</p>
        <ol className={l.flow}>
          {steps.map((step, i) => (
            <li key={step}>
              <span className={l.step} aria-hidden>{i + 1}</span>
              <p><b>{site[`future.${step}`]}</b> {site[`future.${step}.text`]}</p>
            </li>
          ))}
        </ol>
        <p className={l.caption}>{site["future.note"]}</p>
      </div>
    </section>
  );
}

function Pricing() {
  const { site } = useSiteCopy();
  return (
    <section id="pricing" className={`${l.section} ${l.cream}`} aria-labelledby="pricing-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="pricing-heading">{site["pricing.heading"]}</h2>
        <div className={l.plans}>
          <div className={`${l.plan} ${l.onPlum}`}>
            <p className={l.planName}>{site["pricing.free.name"]}</p>
            <h3>{site["pricing.free"]}</h3>
            <ul>{list(site["pricing.free.items"]).map((item) => <li key={item}>{item}</li>)}</ul>
            <div className={l.spacer} />
            <a className={`${l.btn} ${l.apricot}`} href={PROJECT_REPOSITORY}>{site["pricing.free.cta"]}</a>
          </div>
          <div className={`${l.plan} ${l.pro}`}>
            <p className={l.planName}>{site["pricing.pro.name"]}</p>
            <h3>{site["pricing.pro"]}</h3>
            <ul>{list(site["pricing.pro.items"]).map((item) => <li key={item}>{item}</li>)}</ul>
            <div className={l.spacer} />
            <a className={`${l.btn} ${l.ghost}`} href="#waitlist">{site["pricing.pro.cta"]}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Questions() {
  const { site } = useSiteCopy();
  const questions = ["ready", "move", "market", "ai", "shutdown"] as const;
  return (
    <section id="questions" className={`${l.section} ${l.white}`} aria-labelledby="questions-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="questions-heading">{site["faq.heading"]}</h2>
        <div className={l.faq}>
          {questions.map((q) => (
            <details key={q}>
              <summary>{site[`faq.${q}`]}</summary>
              <p>{site[`faq.${q}.answer`]}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The phone's sticky demo button: it appears once the hero buttons have scrolled away and steps aside over the waiting list. */
function Dock({ demo, ctaRow }: { demo: string; ctaRow: RefObject<HTMLDivElement | null> }) {
  const { site } = useSiteCopy();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = ctaRow.current;
    const waitlist = document.getElementById("waitlist");
    if (!hero || !waitlist || !("IntersectionObserver" in window)) return;
    const visible = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      const heroPassed = !visible.get(hero) && hero.getBoundingClientRect().bottom < 0;
      setShow(heroPassed && !visible.get(waitlist));
    });
    observer.observe(hero);
    observer.observe(waitlist);
    return () => observer.disconnect();
  }, [ctaRow]);
  const hidden = show ? {} : { tabIndex: -1 };
  return (
    <div className={l.dock} data-show={show ? "" : undefined} aria-hidden={!show}>
      <a className={l.dockDemo} href={demo} {...hidden}>{site["soon.demo"]}</a>
      <a className={l.dockCode} href={PROJECT_REPOSITORY} aria-label={site["dock.code"]} {...hidden}><GitHubMark /></a>
    </div>
  );
}

export function ProductPage({ links, waitlist, origin }: ProductSiteProps) {
  const { site, locale } = useSiteCopy();
  const demo = locale === "sv" ? `${links.demo}?lang=sv` : links.demo;
  const ctaRow = useRef<HTMLDivElement>(null);
  return (
    <div className={`${l.page} ${l.withDock}`}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} productOrigin={origin} />
      <a className={l.skip} href="#main">{site["skip"]}</a>
      <Hero demo={demo} ctaRow={ctaRow} />
      <main id="main">
        <WhySwitch demo={demo} />
        <Friday demo={demo} />
        <Columns id="features" tone={l.white} heading="features.heading" groups={["features.booking", "features.clients", "features.money", "features.easy"]} />
        <ClientsAi />
        <Columns id="status" tone={l.white} three heading="status.heading" groups={["status.now", "status.next", "status.before"]} />
        <Pricing />
        <Questions />
        <WaitlistForm from={sitePath(locale)} initial={waitlist ?? undefined} demo={demo} />
      </main>
      <SiteFooter />
      <Dock demo={demo} ctaRow={ctaRow} />
    </div>
  );
}
