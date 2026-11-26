import { useSiteCopy } from "../copy";
import h from "./home.module.css";

/** The recorded demo call under public/site, one per site language, with a poster frame and the dialogue as captions. */
function media(locale: string) {
  const base = `/site/phone-receptionist-${locale}`;
  return { src: `${base}.mp4`, poster: `${base}-poster.jpg`, captions: `${base}.vtt` };
}

/**
 * A recorded call to Salong Eko: an AI receptionist checks free times in the demo and books one. A native
 * player that never starts by itself; the hairline and radius sit on the video, so there is no card around it.
 */
export function Receptionist() {
  const { site, locale } = useSiteCopy();
  const { src, poster, captions } = media(locale);
  return (
    <section className={h.reception} aria-labelledby="reception-heading">
      <div className={`${h.wrap} ${h.receptionIn}`}>
        <div className={h.receptionText}>
          <h2 id="reception-heading">{site["home.reception.heading"]}</h2>
          <p>{site["home.reception.text"]}</p>
        </div>
        <figure className={h.receptionFig}>
          <video className={h.receptionVideo} src={src} poster={poster} width={1280} height={720}
            controls playsInline preload="metadata" aria-label={site["home.reception.label"]}>
            {/* The film already shows the conversation on screen, so the caption track is offered, not on by default. */}
            <track kind="captions" src={captions} srcLang={locale} label={site["home.reception.captions"]} />
          </video>
          <figcaption className={h.receptionNote}>{site["home.reception.note"]}</figcaption>
        </figure>
      </div>
    </section>
  );
}
