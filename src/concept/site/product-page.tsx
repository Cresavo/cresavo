import { useEffect, useRef, useState, type RefObject } from "react";
import { CONTACT_EMAIL, PROJECT_REPOSITORY } from "../brand";
import { useSiteCopy } from "./copy";
import { FilmTour } from "./film-tour";
import { sitePath } from "./language";
import type { ProductSiteProps } from "./links";
import { SiteFooter, SiteTopbar } from "./site-chrome";
import { SiteHead } from "./site-head";
import { WaitlistForm } from "./waitlist-form";
import l from "./landing.module.css";

/** The ring screenshot is a dialog crop, so its height differs per language. */
const RING = { en: { width: 760, height: 1039 }, sv: { width: 760, height: 965 } } as const;

const list = (value: string) => value.split("|");

/** Salong Eko's client booking page, on the same host as the studio. */
const BOOKING_PATH = "/boka/salong-eko";

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
          <p className={l.eyebrow}>{site["hero.eyebrow"]}</p>
          <h1>{site["hero.heading"]}</h1>
          <p className={l.lead}>{site["hero.lead"]}</p>
          <div className={l.ctaRow} ref={ctaRow}>
            <a className={`${l.btn} ${l.apricot}`} href={demo}>{site["soon.demo"]}</a>
            <a className={`${l.btn} ${l.ghostCream}`} href="#how">{site["hero.how"]}</a>
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

const MOMENTS = [
  { key: "day", shot: "calendar" },
  { key: "ring", shot: "ring" },
  { key: "card", shot: "customer-card" },
] as const;

/** Three everyday moments, each beside the demo screen that does it. */
function HowItWorks({ demo, booking }: { demo: string; booking: string }) {
  const { site, locale } = useSiteCopy();
  return (
    <section id="how" className={`${l.section} ${l.white} ${l.first}`} aria-labelledby="how-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="how-heading">{site["how.heading"]}</h2>
        <p className={l.intro}>{site["how.intro"]}</p>
        {MOMENTS.map((moment) => (
          <div className={l.job} key={moment.key}>
            <div>
              <h3>{site[`how.${moment.key}`]}</h3>
              <p className={l.more}>{site[`how.${moment.key}.text`]}</p>
            </div>
            {moment.shot === "ring"
              ? <Shot name="ring" alt={site["how.ring.alt"]} {...RING[locale]} className={l.ringShot} />
              : <Shot name={moment.shot} alt={site[`how.${moment.key}.alt`]} />}
          </div>
        ))}
        <p className={l.caption}>{site["how.demoNote"]}</p>
        <div className={l.inlineCta}>
          <a className={`${l.btn} ${l.plum}`} href={demo}>{site["soon.demo"]}</a>
          <a className={l.textLink} href={booking}>{site["how.client"]}</a>
        </div>
      </div>
    </section>
  );
}

const REASONS = [
  { key: "commission" },
  { key: "export" },
  { key: "open", link: { label: "why.open.link", href: PROJECT_REPOSITORY } },
  { key: "assistant" },
] as const;

function Reasons() {
  const { site } = useSiteCopy();
  return (
    <section id="why" className={`${l.section} ${l.cream}`} aria-labelledby="why-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="why-heading">{site["why.heading"]}</h2>
        <p className={l.intro}>{site["why.intro"]}</p>
        <div className={l.reasons}>
          {REASONS.map((reason) => (
            <div className={l.reason} key={reason.key}>
              <h3>{site[`why.${reason.key}`]}</h3>
              <p>
                {site[`why.${reason.key}.text`]}
                {"link" in reason && <> <a href={reason.link.href}>{site[reason.link.label]}</a></>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Founder() {
  const { site, locale } = useSiteCopy();
  return (
    <section id="founder" className={`${l.section} ${l.onPlum}`} aria-labelledby="founder-heading">
      <div className={`${l.wrap} ${l.founder}`}>
        <h2 id="founder-heading">{site["founder.heading"]}</h2>
        <figure>
          <blockquote><p>{site["founder.quote"]}</p></blockquote>
          <figcaption>{site["founder.signature"]}</figcaption>
        </figure>
        <div className={l.inlineCta}>
          <a className={`${l.btn} ${l.ghostCream}`} href={sitePath(locale, "about")}>{site["founder.story"]}</a>
          <a className={l.textLink} href={`mailto:${CONTACT_EMAIL}`}>{site["founder.mail"]}</a>
          <a className={l.textLink} href={`${PROJECT_REPOSITORY}/discussions`}>{site["founder.talk"]}</a>
        </div>
      </div>
    </section>
  );
}

const STATUS = ["status.demo", "status.simulated", "status.next", "status.before"] as const;

/** Where each part stands, then the clients' AI as the clearly marked next step. */
function Status() {
  const { site } = useSiteCopy();
  const steps = ["ask", "suggest", "yes"] as const;
  return (
    <section id="status" className={`${l.section} ${l.white}`} aria-labelledby="status-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="status-heading">{site["status.heading"]}</h2>
        <p className={l.intro}>{site["status.intro"]}</p>
        <div className={l.columns}>
          {STATUS.map((group) => (
            <div key={group}>
              <h3>{site[group]}</h3>
              <ul>{list(site[`${group}.items`]).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className={`${l.next} ${l.onPlum}`}>
          <h3>{site["future.heading"]}</h3>
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
      </div>
    </section>
  );
}

function Pricing({ demo }: { demo: string }) {
  const { site } = useSiteCopy();
  return (
    <section id="pricing" className={`${l.section} ${l.cream}`} aria-labelledby="pricing-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="pricing-heading">{site["pricing.heading"]}</h2>
        <div className={l.plans}>
          <div className={`${l.plan} ${l.onPlum}`}>
            <p className={l.planName}>{site["pricing.hosted.name"]}</p>
            <h3>{site["pricing.hosted"]}</h3>
            <p className={l.planText}>{site["pricing.hosted.text"]}</p>
            <ul>{list(site["pricing.hosted.items"]).map((item) => <li key={item}>{item}</li>)}</ul>
            <div className={l.spacer} />
            <a className={`${l.btn} ${l.apricot}`} href={demo}>{site["soon.demo"]}</a>
          </div>
          <div className={`${l.plan} ${l.self}`}>
            <p className={l.planName}>{site["pricing.self.name"]}</p>
            <h3>{site["pricing.self"]}</h3>
            <p className={l.planText}>{site["pricing.self.text"]}</p>
            <div className={l.spacer} />
            <a className={`${l.btn} ${l.ghost}`} href={PROJECT_REPOSITORY}>{site["pricing.self.cta"]}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = ["ready", "import", "bookings", "help", "export", "shutdown", "market", "ai"] as const;

function Questions() {
  const { site } = useSiteCopy();
  return (
    <section id="questions" className={`${l.section} ${l.white}`} aria-labelledby="questions-heading">
      <div className={l.wrap}>
        <h2 className={l.title} id="questions-heading">{site["faq.heading"]}</h2>
        <div className={l.faq}>
          {QUESTIONS.map((q) => (
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

/** The last step while the waiting list takes no sign-ups: the demo, the client's booking page and a way to talk. */
function Closing({ demo, booking }: { demo: string; booking: string }) {
  const { site } = useSiteCopy();
  return (
    <section id="waitlist" className={`${l.waitlist} ${l.onPlum}`} aria-labelledby="closing-heading">
      <div className={l.wrap}>
        <h2 id="closing-heading">{site["closing.heading"]}</h2>
        <p className={l.wlLead}>{site["closing.text"]}</p>
        <div className={l.ctaRow}>
          <a className={`${l.btn} ${l.apricot}`} href={demo}>{site["soon.demo"]}</a>
          <a className={`${l.btn} ${l.ghostCream}`} href={booking}>{site["how.client"]}</a>
        </div>
        <p className={l.wlAlt}>
          <a href={`mailto:${CONTACT_EMAIL}`}>{site["closing.mail"]}</a>
          <a href={`${PROJECT_REPOSITORY}/discussions`}>{site["closing.talk"]}</a>
        </p>
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

export function ProductPage({ links, waitlist, waitlistOpen, origin }: ProductSiteProps) {
  const { site, locale } = useSiteCopy();
  // The demo opens in the language of the page the visitor came from, whatever an earlier visit saved.
  const query = `?lang=${locale}`;
  const demo = `${links.demo}${query}`;
  const booking = `${links.demo.replace(/\/studio$/, BOOKING_PATH)}${query}`;
  const ctaRow = useRef<HTMLDivElement>(null);
  return (
    <div className={`${l.page} ${l.withDock}`}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} productOrigin={origin} />
      <a className={l.skip} href="#main">{site["skip"]}</a>
      <Hero demo={demo} ctaRow={ctaRow} />
      <main id="main">
        <HowItWorks demo={demo} booking={booking} />
        <FilmTour booking={booking} />
        <Reasons />
        <Founder />
        <Status />
        <Pricing demo={demo} />
        <Questions />
        {waitlistOpen
          ? <WaitlistForm from={sitePath(locale)} initial={waitlist ?? undefined} demo={demo} />
          : <Closing demo={demo} booking={booking} />}
      </main>
      <SiteFooter />
      <Dock demo={demo} ctaRow={ctaRow} />
    </div>
  );
}
