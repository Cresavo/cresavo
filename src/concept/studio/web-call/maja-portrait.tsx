import { t } from "../../i18n";

// Optimized avatar of the fictional receptionist (option 4: dark brown
// ponytail, green knit). 384px AVIF + WebP, cropped for a round call mark.
export const MAJA_PORTRAIT = {
  avif: "/studio/maja.avif",
  webp: "/studio/maja.webp",
} as const;

export function MajaPortrait({ className = "size-full object-cover" }: { className?: string }) {
  return (
    <picture className="block size-full">
      <source type="image/avif" srcSet={MAJA_PORTRAIT.avif} />
      <img src={MAJA_PORTRAIT.webp} alt={t("webCall.maja")} className={className} />
    </picture>
  );
}
