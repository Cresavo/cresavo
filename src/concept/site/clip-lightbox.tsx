import { useEffect, useRef } from "react";
import { MediaDialog } from "../ui/media-dialog";
import { useSiteCopy } from "./copy";

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
  const { site } = useSiteCopy();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
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
    <MediaDialog title={title} closeLabel={site["clip.close"]} ratio={ratio} mediaRef={videoRef}
      onClose={() => onClose(videoRef.current!.currentTime)}>
      <video ref={videoRef} tabIndex={0} src={src} poster={poster} controls playsInline preload="metadata" aria-label={description} />
    </MediaDialog>
  );
}
