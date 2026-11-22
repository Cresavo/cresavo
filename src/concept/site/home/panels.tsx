import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { useSiteCopy } from "../copy";
import { Icon } from "./icons";
import { fill, price } from "./text";
import { useMedia } from "./use-media";
import p from "./panels.module.css";

// HTML replicas of the demo's screens with Salong Eko's invented data: the booking
// page, Today, a client card, the Someone is calling dialog and a client's own AI.

/** The name typed into the Someone is calling search, an invented client. */
const CALLER = "Lena Strand";

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;
/** A part of a panel that rises in, `i` steps after the panel itself. */
const St = ({ i, className = "", ...rest }: { i: number } & HTMLAttributes<HTMLDivElement>) => (
  <div className={`${p.st} ${className}`} style={stagger(i)} {...rest} />
);

function usePrice() {
  const { site, locale } = useSiteCopy();
  return (amount: number) => price(site["home.price"], locale, amount);
}

/** A product screen in a window frame. `crop` shows the top of it on phones. */
function Panel({ label, bar, crop = false, chat = false, children }: { label: string; bar: string; crop?: boolean; chat?: boolean; children: ReactNode }) {
  return (
    <figure className={`${chat ? p.chat : p.panel} ${crop ? p.crop : ""}`} aria-label={label} data-reveal="panel">
      <div className={p.panelBar}><span className={p.pbSalon}>{bar}</span></div>
      {children}
    </figure>
  );
}

const Staff = ({ who }: { who: "anna" | "erik" }) => <i className={`${p.sd} ${who === "anna" ? p.sdAnna : p.sdErik}`} aria-hidden="true" />;

export function BookingPanel() {
  const { site } = useSiteCopy();
  const sek = usePrice();
  const row = (name: string, duration: string, staff: string, amount: number, picked?: ReactNode) => (
    <li className={`${p.bkRow} ${picked ? p.isOn : ""}`}>
      <div className={p.bkInfo}><b>{name}</b><span>{fill(site["home.book.with"], { what: duration, staff })}</span></div>
      <div className={p.bkAct}><span className={p.bkPrice}>{sek(amount)}</span><span className={`${p.ub} ${p.ubPlum}`}>{site["home.book.cta"]}</span></div>
      {picked}
    </li>
  );
  const hour = site["home.hour"];
  return (
    <Panel label={site["home.book.label"]} bar={site["home.book.bar"]}>
      <div className={p.panelBody}>
        <St i={0} className={p.bkHead}>
          <span className={p.bkLogo} aria-hidden="true" />
          <div><p className={p.apTitle}>Salong Eko</p><p className={p.apMeta}>{site["home.book.tagline"]}</p></div>
        </St>
        <St i={1}><p className={p.bkG}>{site["home.book.foot"]}</p></St>
        <St i={2}>
          <ul className={p.bkList}>
            {row(site["home.service.medical"], hour, "Anna", 795)}
            {row(site["home.service.spa"], `${hour} 15 min`, "Anna", 950, (
              <div className={p.bkPick}>
                <p>{site["home.date"]}</p>
                <div className={p.slots}>
                  <span className={`${p.slot} ${p.anna}`} data-pick=""><b>10:30</b> Anna</span>
                  <span className={`${p.slot} ${p.anna}`}><b>14:00</b> Anna</span>
                </div>
              </div>
            ))}
          </ul>
        </St>
        <St i={3}><p className={p.bkG}>{site["home.book.massage"]}</p></St>
        <St i={4}>
          <ul className={p.bkList}>
            {row(site["home.service.classic"], hour, "Erik", 795)}
            {row(site["home.service.relax"], `${hour} 30 min`, "Erik", 1195)}
          </ul>
        </St>
      </div>
    </Panel>
  );
}

export function TodayPanel() {
  const { site } = useSiteCopy();
  const visits = [
    { t: "10:30", who: "Ulf Ljung", staff: "anna", what: site["home.service.spa"], flag: site["home.today.new"], className: p.isNew },
    { t: "11:00", who: "Ellen Berg", staff: "erik", what: site["home.service.relax"] },
    { t: "13:00", who: site["home.today.free"], staff: "anna", what: site["home.hour"], flag: site["home.today.room"], className: p.isFree },
    { t: "14:00", who: "Henrik Lindberg", staff: "erik", what: site["home.service.classic"] },
    { t: "15:30", who: "Maja Andersson", staff: "anna", what: site["home.service.medical"] },
  ] as const;
  return (
    <Panel label={site["home.today.label"]} bar={site["home.today.bar"]}>
      <div className={p.panelBody}>
        <St i={0} className={p.apTop}>
          <div>
            <p className={p.apTitle}>{site["home.today.greeting"]}</p>
            <p className={p.apMeta}>{site["home.date"]}</p>
          </div>
          <div className={p.apActions}>
            <span className={`${p.ub} ${p.ubPlum}`}><Icon name="phone" className={p.ic} />{site["home.today.calling"]}</span>
            <span className={`${p.ub} ${p.ubLine}`}><Icon name="chat" className={p.ic} />{site["home.today.assistant"]}</span>
          </div>
        </St>
        <St i={1} className={`${p.ucard} ${p.nextc}`}>
          <p className={p.nxL}>{site["home.today.next"]} · 09:00</p>
          <div className={p.person}>
            <span className={p.avatar}>AE</span>
            <div>
              <p className={p.pName}>Agneta Ek</p>
              <p className={p.pSub}><Staff who="anna" />{fill(site["home.book.with"], { what: site["home.service.medical"], staff: "Anna" })}</p>
            </div>
          </div>
        </St>
        <St i={2}>
          <ul className={p.sched}>
            {visits.map((v) => (
              <li key={v.t} className={"className" in v ? v.className : undefined}>
                <span className={p.t}>{v.t}</span>
                <span className={p.who}><b>{v.who}</b><span><Staff who={v.staff} />{v.staff === "anna" ? "Anna" : "Erik"} · {v.what}</span></span>
                {"flag" in v && <span className={p.flag}>{v.flag}</span>}
              </li>
            ))}
          </ul>
        </St>
        <St i={3} className={p.inbox}>
          <Icon name="mail" className={p.ic} />
          <div><p className={p.pName}>{site["home.today.inbox"]}</p><p className={p.pSub}>{site["home.today.inbox.text"]}</p></div>
          <span className={`${p.ub} ${p.ubLine}`}>{site["home.today.inbox.open"]}</span>
        </St>
      </div>
    </Panel>
  );
}

const TABS = ["overview", "history", "journal"] as const;

function Upcoming() {
  const { site } = useSiteCopy();
  const sek = usePrice();
  return (
    <>
      <p className={p.apH}><span>{site["home.card.upcoming"]}</span></p>
      <div className={p.upRow}>
        <span className={p.upDate}><b>{site["home.card.day"]}</b>09:00</span>
        <span className={p.upWhat}><Staff who="anna" />Anna · {site["home.service.medical"]}</span>
        <span className={p.upPrice}>{sek(795)}</span>
        <Icon name="chev" className={p.ic} />
      </div>
    </>
  );
}

export function ClientPanel() {
  const { site } = useSiteCopy();
  const sek = usePrice();
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const arrow = (i: number, key: string) => {
    const dir = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    const next = (i + dir + TABS.length) % TABS.length;
    setTab(TABS[next]);
    tabs.current[next]?.focus();
  };
  const panel = (name: (typeof TABS)[number], body: ReactNode) => (
    <div className={p.tp} role="tabpanel" id={`tp-${name}`} aria-labelledby={`tab-${name}`} hidden={tab !== name}>{body}</div>
  );
  return (
    <Panel label={site["home.card.label"]} bar={site["home.card.bar"]}>
      <div className={`${p.panelBody} ${p.client}`}>
        <div>
          <St i={0} className={p.ucard}>
            <div className={p.person}>
              <span className={`${p.avatar} ${p.lg}`}>AE</span>
              <p className={`${p.pName} ${p.lg}`}>Agneta Ek</p>
            </div>
            <p className={p.cNote}>{site["home.card.note"]}</p>
            <p className={p.cLine}><Icon name="phone" className={p.ic} />070-173 74 60</p>
            <p className={p.cLine}><Icon name="mail" className={p.ic} />agneta.ek@mail.example</p>
            <div className={p.btn2}>
              <span className={`${p.ub} ${p.ubLine}`}><Icon name="phone" className={p.ic} />{site["home.card.call"]}</span>
              <span className={`${p.ub} ${p.ubLine}`}><Icon name="chat" className={p.ic} />{site["home.card.sms"]}</span>
            </div>
          </St>
          <St i={1} className={`${p.ucard} ${p.ucardNext}`}>
            <Icon name="cal" className={p.ic} />
            <div>
              <p className={p.cap}>{site["home.card.next"]}</p>
              <p className={p.pName}>{site["home.card.next.when"]}</p>
              <p className={p.pSub}>{site["home.card.next.what"]}</p>
            </div>
          </St>
        </div>
        <div>
          <St i={2} className={p.tabs} role="tablist" aria-label={site["home.card.tabs"]}>
            {TABS.map((name, i) => (
              <button key={name} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`tab-${name}`} aria-controls={`tp-${name}`}
                aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(e) => arrow(i, e.key)}>
                {site[`home.card.${name}`]}
              </button>
            ))}
          </St>
          <St i={3} className={p.tps}>
            {panel("overview", <>
              <dl className={p.stats}>
                <div><dt>{site["home.card.visits"]}</dt><dd>6</dd></div>
                <div><dt>{site["home.card.spent"]}</dt><dd>{sek(4135)}</dd></div>
                <div><dt>{site["home.card.last"]}</dt><dd>{site["home.card.last.value"]}</dd></div>
                <div><dt>{site["home.card.usual"]}</dt><dd>{site["home.service.medical"]}</dd></div>
              </dl>
              <Upcoming />
            </>)}
            {panel("history", <>
              <Upcoming />
              <p className={`${p.apH} ${p.hiGap}`}><span>{site["home.card.earlier"]}</span></p>
              <div className={`${p.upRow} ${p.upSum}`}>
                <span className={p.upWhat}>{fill(site["home.card.sum"], { price: sek(4135) })}</span>
                <span className={p.upPrice}>{site["home.card.sum.last"]}</span>
              </div>
            </>)}
            {panel("journal", (
              <div className={p.jo}>
                <p className={p.cap}>{site["home.card.noteCap"]}</p>
                <p>{site["home.card.note"]}</p>
              </div>
            ))}
          </St>
        </div>
      </div>
    </Panel>
  );
}

/** Someone is calling: once on screen, a name types into the search and one free time is picked. */
export function CallPanel() {
  const { site } = useSiteCopy();
  const box = useRef<HTMLDivElement>(null);
  const still = useMedia("(prefers-reduced-motion: reduce)", false);
  const [step, setStep] = useState(0);
  const typed = still ? CALLER.length : step;
  const done = typed >= CALLER.length;

  useEffect(() => {
    const el = box.current;
    if (!el || still) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let at = 1000;
      for (let i = 1; i <= CALLER.length; i++) {
        at += 70 + Math.random() * 70;
        timers.push(window.setTimeout(() => setStep(i), at));
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => { observer.disconnect(); timers.forEach(clearTimeout); };
  }, [still]);

  return (
    <Panel label={site["home.call.label"]} bar={site["home.today.bar"]} crop>
      <div className={`${p.panelBody} ${p.dim}`}>
        <div className={p.dialog} ref={box}>
          <St i={0} className={p.dlgHead}>
            <p className={`${p.apTitle} ${p.sm}`}>{site["home.today.calling"]}</p>
            <span className={p.x} aria-hidden="true" />
          </St>
          <St i={1} className={p.search} data-typed={typed ? "" : undefined}>
            <Icon name="search" className={p.ic} />
            <span className={p.ph}>{typed ? CALLER.slice(0, typed) : site["home.call.search"]}</span>
            <span className={p.caret} aria-hidden="true" />
          </St>
          <St i={2}><p className={p.cap}>{site["home.call.free"]}</p></St>
          <St i={3} className={p.dayBlock}>
            <p className={p.dName}>{site["home.call.today"]}</p>
            <div className={p.slots}><span className={`${p.slot} ${p.anna}`} data-pick={done ? "" : undefined}><b>13:00</b> Anna · {site["home.hour"]}</span></div>
          </St>
          <St i={4} className={p.dayBlock}>
            <p className={p.dName}>{site["home.call.monday"]}</p>
            <div className={p.slots}>
              <span className={`${p.slot} ${p.erik}`}><b>09:00</b> Erik · 45 min</span>
              <span className={`${p.slot} ${p.anna}`}><b>11:30</b> Anna · 30 min</span>
            </div>
          </St>
        </div>
      </div>
    </Panel>
  );
}

/** How a client's own AI would book, in three steps. */
export function ChatPanel() {
  const { site } = useSiteCopy();
  const sek = usePrice();
  return (
    <Panel label={site["home.next.label"]} bar={site["home.next.bar"]} chat>
      <ol className={p.chatBody}>
        <li className={`${p.cRow} ${p.me} ${p.st}`} style={stagger(0)}>
          <span className={p.n} aria-hidden="true">1</span>
          <p className={p.bubble}>{site["home.next.ask"]}</p>
        </li>
        <li className={`${p.cRow} ${p.ai} ${p.st}`} style={stagger(1)}>
          <span className={p.n} aria-hidden="true">2</span>
          <div className={`${p.bubble} ${p.offer}`}>
            <p>{site["home.next.offer"]}</p>
            <div className={p.prop}>
              <p className={p.propWhen}>{site["home.next.when"]}</p>
              <p className={p.propWhat}><Staff who="anna" />{site["home.next.what"]}</p>
              <p className={p.propMeta}>{fill(site["home.next.meta"], { price: sek(950) })}</p>
              <span className={`${p.ub} ${p.ubPlum} ${p.propBtn}`}>{site["home.next.confirm"]}</span>
            </div>
          </div>
        </li>
        <li className={`${p.cRow} ${p.st}`} style={stagger(2)}>
          <span className={p.n} aria-hidden="true">3</span>
          <div className={p.resIn}>
            <p className={p.cap}>{site["home.next.after"]}</p>
            <div className={p.mcal} role="img" aria-label={site["home.next.calendar"]}>
              <span className={p.mcT}>13:00</span><span className={p.mcL} />
              <span className={p.mcT}>14:00</span><span className={p.mcB}><b>14:00 {site["home.service.spa"]}</b> · Anna</span>
              <span className={p.mcT}>15:00</span><span className={p.mcL} />
            </div>
          </div>
        </li>
      </ol>
    </Panel>
  );
}
