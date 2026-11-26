import type { Metadata } from "next";
import { CLASSIC_PALETTE, CLASSIC_THEME_KEY } from "@/concept/showcase/klassisk/palette";
import { StandaloneBooking } from "@/concept/showcase/standalone";
import k from "@/concept/showcase/klassisk/klassisk.module.css";

export const metadata: Metadata = { title: "Boka tid" };

export default function Page() {
  return <StandaloneBooking styles={k} home="/showcase/salong-klassisk" themeKey={CLASSIC_THEME_KEY} initialTheme="light" palette={CLASSIC_PALETTE} corners="soft" />;
}
