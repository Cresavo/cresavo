import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { site } from "./en";
import s from "./site.module.css";

export const TOUR_POSTER = "/site/tour-16x9-poster.jpg";

type Clip = "tour-16x9" | "booking" | "day" | "treatments" | "campaign" | "journal";

export function TourClip({ name, description, title }: { name: Clip; description: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [dark, setDark] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [choice, setChoice] = useState<"play" | "pause" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const isTour = name === "tour-16x9";
  const prefix = `/site/${name}${isTour || name === "booking" ? "" : dark ? "-dark" : "-light"}`;
  const shouldPlay = choice === "play" ? fraction > 0 : !reduced && choice !== "pause" && fraction >= .65;

  useEffect(() => {
    const video = ref.current!;
    const theme = matchMedia("(prefers-color-scheme: dark)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const syncTheme = () => setDark(theme.matches);
    const syncMotion = () => { setReduced(motion.matches); setChoice(null); };
    syncTheme();
    syncMotion();
    theme.addEventListener("change", syncTheme);
    motion.addEventListener("change", syncMotion);
    const preloadPoster = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); preloadPoster.disconnect(); }
    }, { rootMargin: "120px" });
    const inView = new IntersectionObserver(([entry]) => {
      setFraction(entry.intersectionRatio);
      if (!entry.isIntersecting && motion.matches) setChoice(null);
    }, { threshold: [0, .01, .65] });
    preloadPoster.observe(video);
    inView.observe(video);
    return () => {
      theme.removeEventListener("change", syncTheme);
      motion.removeEventListener("change", syncMotion);
      preloadPoster.disconnect();
      inView.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = ref.current!;
    const sync = () => {
      if (shouldPlay && !document.hidden) {
        // Let the hero poster, fonts and page assets finish before starting the film.
        if (isTour && choice !== "play" && document.readyState !== "complete") return;
        // Attach one supported encoding only when the clip actually needs to play.
        const src = prefix + (!isTour && video.canPlayType("video/webm; codecs=vp9") ? ".webm" : ".mp4");
        if (video.getAttribute("src") !== src) video.setAttribute("src", src);
        void video.play().catch((error: DOMException) => {
          if (error.name === "NotAllowedError") setChoice("pause");
        });
      } else {
        video.pause();
        if (document.hidden && reduced) setChoice(null);
        const src = video.getAttribute("src");
        if (src && ((reduced && choice !== "play") || !src.startsWith(prefix + "."))) {
          video.removeAttribute("src");
          video.load(); // restore the themed poster, including on a live motion preference change
        }
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    if (isTour) window.addEventListener("load", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("load", sync);
    };
  }, [shouldPlay, reduced, choice, prefix, isTour]);

  const video = (
    <video ref={ref} muted={muted} playsInline loop preload="none"
      width={isTour ? 960 : 928} height={isTour ? 540 : 760} aria-label={description}
      poster={isTour ? TOUR_POSTER : near ? prefix + ".webp" : undefined}
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEmptied={() => setPlaying(false)} />
  );
  const playButton = (
    <button type="button" className={isTour ? s.tourButton : s.clipControl}
      aria-label={`${site[playing ? "clip.pause" : "clip.play"]} — ${title}`}
      onClick={() => setChoice(playing ? "pause" : "play")}>
      {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      {isTour && title}
    </button>
  );

  if (!isTour) return <div className={s.clip}>{video}{playButton}</div>;

  return (
    <figure className={s.tourFrame}>
      {video}
      <figcaption>
        {playButton}
        <span className={s.tourDuration}>{site["soon.tour.duration"]}</span>
        <button type="button" className={s.tourButton} aria-label={site[muted ? "soon.tour.unmute" : "soon.tour.mute"]}
          onClick={() => setMuted(!muted)}>
          {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
        </button>
      </figcaption>
    </figure>
  );
}
