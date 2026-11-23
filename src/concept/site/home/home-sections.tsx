import { CONTACT_EMAIL, PROJECT_REPOSITORY } from "../../brand";
import { Wordmark } from "../../ui/wordmark";
import { useSiteCopy } from "../copy";
import { sitePath } from "../language";
import { GitHubIcon, Icon } from "./icons";
import { ChatPanel } from "./panels";
import { fill, list } from "./text";
import { useMedia } from "./use-media";
import h from "./home.module.css";

const DISCUSSIONS = `${PROJECT_REPOSITORY}/discussions`;

export function Manifesto() {
  const { site } = useSiteCopy();
  return (
    <section className={h.manifesto} aria-labelledby="own-heading">
      <div className={h.wrap}>
        <h2 id="own-heading" className={h.srOnly}>{site["home.own.heading"]}</h2>
        <p className={h.note}>{site["home.own.eyebrow"]}</p>
        <ul>
          {list(site["home.own.items"]).map((line) => <li className={h.mfLine} key={line}>{line}.</li>)}
        </ul>
      </div>
    </section>
  );
}

export function OpenSource() {
  const { site } = useSiteCopy();
  return (
    <section className={h.open} id="open" aria-labelledby="open-heading">
      <div className={`${h.wrap} ${h.openGrid}`}>
        <div className={h.openCopy}>
          <h2 id="open-heading">{site["home.open.heading"]}</h2>
          <ul className={h.benefits}>
            <li><b>{site["home.open.export"]}</b> <span>{site["home.open.export.text"]}</span></li>
            <li><b>{site["home.open.inspect"]} <span className={h.nw}>(AGPL-3.0)</span>.</b></li>
            <li><b>{site["home.open.run"]}</b></li>
          </ul>
        </div>
        <aside className={h.osCard}>
          <p className={h.osCap}>{site["home.open.caption"]}</p>
          <p className={h.osCmd}><span>$</span> gh repo clone {PROJECT_REPOSITORY.replace("https://github.com/", "")}</p>
          <div className={`${h.ctaRow} ${h.osRow}`}>
            <a className={h.textLink} href={PROJECT_REPOSITORY}><GitHubIcon className={`${h.ic} ${h.icFill}`} /> {site["home.open.code"]}</a>
            <a className={h.textLink} href={DISCUSSIONS}>{site["home.open.discussions"]}</a>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function NextStep() {
  const { site } = useSiteCopy();
  return (
    <section className={h.next} aria-labelledby="next-heading">
      <div className={`${h.wrap} ${h.nextGrid}`}>
        <div className={h.nextCopy}>
          <p className={h.note}>{site["home.next.badge"]}</p>
          <h2 id="next-heading">{site["home.next.heading"]}</h2>
          <p className={h.lead}>{site["home.next.lead"]}</p>
        </div>
        <ChatPanel />
      </div>
    </section>
  );
}

export function Founder() {
  const { site, locale } = useSiteCopy();
  return (
    <section className={h.founder} aria-labelledby="story-heading">
      <div className={h.wrap}>
        <h2 id="story-heading" className={h.minorHead}>{site["founder.heading"]}</h2>
        <figure>
          <blockquote><p>{fill(site["founder.quoted"], { quote: site["founder.quote"] })}</p></blockquote>
          <figcaption>
            <span className={h.sig}>{site["founder.signature"]}</span>
            <a className={h.inline} href={sitePath(locale, "about")}>{site["founder.story"]}</a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

const STATUS = [
  { key: "status.demo", mark: h.mkFull },
  { key: "status.simulated", mark: h.mkHalf },
  { key: "status.next", mark: h.mkRing },
  { key: "status.before", mark: h.mkDash },
] as const;

/** Four groups: open columns from 700 px, collapsed rows with a count on phones. */
export function Status() {
  const { site } = useSiteCopy();
  const wide = useMedia("(min-width: 700px)", true);
  return (
    <section className={h.status} aria-labelledby="status-heading">
      <div className={h.wrap}>
        <header className={h.secHead}>
          <h2 id="status-heading">{site["status.heading"]}</h2>
        </header>
        <div className={h.cols}>
          {STATUS.map(({ key, mark }) => {
            const items = list(site[`${key}.items`]);
            return (
              <details className={h.col} key={key} open={wide}>
                <summary tabIndex={wide ? -1 : undefined}>
                  <h3>
                    <i className={`${h.mk} ${mark}`} aria-hidden="true" />
                    <span className={h.sL}>{site[key]}</span>
                    <span className={h.sN}><span className={h.srOnly}>, </span>{items.length}<span className={h.srOnly}> {site["status.unit"]}</span></span>
                  </h3>
                </summary>
                <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const { site } = useSiteCopy();
  return (
    <section className={h.pricing} id="pricing" aria-labelledby="pricing-heading">
      <div className={h.wrap}>
        <header className={h.secHead}>
          <h2 id="pricing-heading">{site["pricing.heading"]}</h2>
        </header>
        <div className={h.plans}>
          <article className={`${h.plan} ${h.featured}`} aria-labelledby="plan-hosted">
            <p className={h.planTag}>{site["pricing.tag"]}</p>
            <h3 id="plan-hosted">{site["pricing.hosted.name"]}</h3>
            <p className={h.price}>{site["pricing.hosted"]}</p>
            <ul>{list(site["pricing.hosted.items"]).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className={`${h.plan} ${h.self}`} aria-labelledby="plan-self">
            <h3 id="plan-self">{site["pricing.self.name"]}</h3>
            <p className={h.price}>{site["pricing.self"]} <span>(AGPL-3.0)</span></p>
            <ul>{list(site["pricing.self.items"]).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = ["ready", "commission", "import", "bookings", "help", "export", "shutdown", "market", "ai"] as const;

export function Questions() {
  const { site } = useSiteCopy();
  const mail = <a className={h.inline} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <section className={h.faq} id="questions" aria-labelledby="faq-heading">
      <div className={`${h.wrap} ${h.faqGrid}`}>
        <header className={h.secHead}>
          <h2 id="faq-heading">{site["faq.heading"]}</h2>
          <p className={h.muted}>{site["faq.more"]} {mail}</p>
        </header>
        <div className={h.faqList}>
          {QUESTIONS.map((q) => (
            <details key={q}>
              <summary>{site[`faq.${q}`]}</summary>
              <p>{fill(site[`faq.${q}.answer`], { email: mail, discussions: <a className={h.inline} href={DISCUSSIONS}>GitHub Discussions</a> })}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The calm last ask: the demo, and a line to the founder about what the salon needs. */
export function Closing({ demo }: { demo: string }) {
  const { site } = useSiteCopy();
  return (
    <section className={h.close} id="closing" aria-labelledby="closing-heading">
      <div className={h.wrap}>
        <h2 id="closing-heading">{site["closing.heading"]}</h2>
        <p className={h.lead}>{site["closing.text"]}</p>
        <div className={`${h.ctaRow} ${h.closeCta}`}>
          <a className={`${h.btn} ${h.btnPlum}`} href={demo}>{site["home.demo"]} <Icon name="arrow" className={h.ic} /></a>
          <a className={h.textLink} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(site["closing.subject"])}`}>
            <Icon name="mail" className={h.ic} /> {site["closing.mail"]}
          </a>
        </div>
      </div>
    </section>
  );
}

export function HomeFooter({ demo, booking }: { demo: string; booking: string }) {
  const { site, locale } = useSiteCopy();
  const other = locale === "sv" ? "en" : "sv";
  return (
    <footer className={h.footer}>
      <div className={`${h.wrap} ${h.footIn}`}>
        <div className={h.footBrand}>
          <Wordmark />
          <p>{site["home.footer.tagline"]}</p>
        </div>
        <nav className={h.footLinks} aria-label={site["footer.nav"]}>
          <ul>
            <li><a href={demo}>{site["home.footer.studio"]}</a></li>
            <li><a href={booking}>{site["home.footer.booking"]}</a></li>
            <li><a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a></li>
            <li><a href={DISCUSSIONS}>{site["home.open.discussions"]}</a></li>
          </ul>
          <ul>
            <li><a href={sitePath(locale, "about")}>{site["home.footer.story"]}</a></li>
            <li><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
            <li><a href={sitePath(locale, "privacy")}>{site["waitlist.privacy"]}</a></li>
            <li><a href={sitePath(other)} lang={other} hrefLang={other}>{site["home.lang"]}</a></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
