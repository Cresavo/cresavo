import type { ReactNode } from "react";
import { useSiteCopy } from "../copy";
import { fill, price } from "./text";
import p from "./panels.module.css";

// The one coded panel left on the homepage: how a client's own AI would book with Salong Eko. It shows
// something still being tested, so it is drawn rather than photographed from the demo.

function Panel({ label, bar, children }: { label: string; bar: string; children: ReactNode }) {
  return (
    <figure className={p.chat} aria-label={label}>
      <div className={p.panelBar}><span className={p.pbSalon}>{bar}</span></div>
      {children}
    </figure>
  );
}

const Staff = () => <i className={`${p.sd} ${p.sdAnna}`} aria-hidden="true" />;

/** How a client's own AI would book, in three steps. */
export function ChatPanel() {
  const { site, locale } = useSiteCopy();
  const sek = (amount: number) => price(site["home.price"], locale, amount);
  return (
    <Panel label={site["home.next.label"]} bar={site["home.next.bar"]}>
      <ol className={p.chatBody}>
        <li className={`${p.cRow} ${p.me}`}>
          <span className={p.n} aria-hidden="true">1</span>
          <p className={p.bubble}>{site["home.next.ask"]}</p>
        </li>
        <li className={`${p.cRow} ${p.ai}`}>
          <span className={p.n} aria-hidden="true">2</span>
          <div className={`${p.bubble} ${p.offer}`}>
            <p>{site["home.next.offer"]}</p>
            <div className={p.prop}>
              <p className={p.propWhen}>{site["home.next.when"]}</p>
              <p className={p.propWhat}><Staff />{site["home.next.what"]}</p>
              <p className={p.propMeta}>{fill(site["home.next.meta"], { price: sek(950) })}</p>
              <span className={`${p.ub} ${p.ubPlum} ${p.propBtn}`}>{site["home.next.confirm"]}</span>
            </div>
          </div>
        </li>
        <li className={`${p.cRow}`}>
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
