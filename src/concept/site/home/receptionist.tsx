import { useSiteCopy } from "../copy";
import h from "./home.module.css";

/** The recorded demo call under public/site, one per site language, with its first frame as the poster. */
function media(locale: string) {
  return { src: `/site/phone-receptionist-${locale}.mp4`, poster: `/site/phone-receptionist-${locale}-poster.jpg` };
}

/**
 * A recorded call to Salong Eko: an AI receptionist checks free times in the demo and books one. A native
 * player that never starts by itself; the hairline and radius sit on the video, so there is no card around it.
 */
export function Receptionist() {
  const { site, locale } = useSiteCopy();
  const { src, poster } = media(locale);
  return (
    <section className={h.reception} aria-labelledby="reception-heading">
      <div className={`${h.wrap} ${h.receptionIn}`}>
        <div className={h.receptionText}>
          <h2 id="reception-heading">{site["home.reception.heading"]}</h2>
          <p>{site["home.reception.text"]}</p>
        </div>
        <figure className={h.receptionFig}>
          <video className={h.receptionVideo} src={src} poster={poster} width={1280} height={720}
            controls playsInline preload="metadata" aria-label={site["home.reception.label"]} />
          <figcaption className={h.receptionNote}>{site["home.reception.note"]}</figcaption>
        </figure>
      </div>
    </section>
  );
}
