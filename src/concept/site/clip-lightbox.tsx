import { useEffect, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";
import { site } from "./en";
import s from "./site.module.css";

interface LightboxProps {
  src: string;
  ratio: number;
  poster?: string;
  start: number;
  title: string;
  description: string;
  onClose: (time: number) => void;
}

export function ClipLightbox({ src, ratio, poster, start, title, description, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const video = videoRef.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    dialog.showModal();
    closeRef.current?.focus();
    video.currentTime = start;
    if (!motion.matches) void video.play().catch(() => {});
    const syncMotion = () => { if (motion.matches) video.pause(); };
    motion.addEventListener("change", syncMotion);
    return () => {
      video.pause();
      motion.removeEventListener("change", syncMotion);
    };
  }, [start]);

  return (
    <dialog ref={dialogRef} className={s.lightbox} aria-label={title}
      style={{ "--film-ratio": ratio } as CSSProperties}
      onClose={() => onClose(videoRef.current!.currentTime)}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      {/* Let Tab visit the native media controls, then cycle inside the dialog in either direction. */}
      <span tabIndex={0} className={s.focusGuard} onFocus={() => videoRef.current?.focus()} />
      <div className={s.lightboxPanel}>
        <header>
          <strong>{title}</strong>
          <button ref={closeRef} type="button" className={s.tourButton} onClick={() => dialogRef.current?.close()}>
            <X size={18} aria-hidden />{site["clip.close"]}
          </button>
        </header>
        <video ref={videoRef} tabIndex={0} src={src} poster={poster} controls playsInline preload="metadata" aria-label={description} />
      </div>
      <span tabIndex={0} className={s.focusGuard} onFocus={() => closeRef.current?.focus()} />
    </dialog>
  );
}
