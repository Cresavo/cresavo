import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { site } from "./en";
import s from "./site.module.css";

type Clip = "booking" | "day" | "treatments" | "campaign" | "journal";

export function TourClip({ name, description, title }: { name: Clip; description: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [dark, setDark] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [choice, setChoice] = useState<"play" | "pause" | null>(null);
  const [playing, setPlaying] = useState(false);
  const prefix = `/site/${name}${name === "booking" ? "" : dark ? "-dark" : "-light"}`;
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
        // Attach one supported encoding only when the clip actually needs to play.
        const src = prefix + (video.canPlayType("video/webm; codecs=vp9") ? ".webm" : ".mp4");
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
    return () => document.removeEventListener("visibilitychange", sync);
  }, [shouldPlay, reduced, choice, prefix]);

  return (
    <div className={s.clip}>
      <video ref={ref} muted playsInline loop preload="none" width={928} height={760} aria-label={description}
        poster={near ? prefix + ".webp" : undefined} onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEmptied={() => setPlaying(false)} />
      <button type="button" className={s.clipControl} aria-label={`${site[playing ? "clip.pause" : "clip.play"]} — ${title}`}
        onClick={() => setChoice(playing ? "pause" : "play")}>
        {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
      </button>
    </div>
  );
}
