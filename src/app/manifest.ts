import type { MetadataRoute } from "next";
import { BRAND } from "@/concept/brand";
import { APP_ICONS, THEME_COLORS } from "@/concept/ui/brand-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} (demo)`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/studio",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.action,
    icons: APP_ICONS.map((icon) => ({ ...icon, purpose: "any" })),
  };
}
