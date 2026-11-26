import type { Metadata } from "next";
import { StandaloneBooking } from "@/concept/showcase/standalone";
import { BOLD_PALETTE, BOLD_THEME_KEY } from "@/concept/showcase/vagad/palette";
import v from "@/concept/showcase/vagad/vagad.module.css";

export const metadata: Metadata = { title: "Boka tid" };

export default function Page() {
  return <StandaloneBooking styles={v} home="/showcase/salong-vagad" themeKey={BOLD_THEME_KEY} initialTheme="dark" palette={BOLD_PALETTE} corners="sharp" />;
}
