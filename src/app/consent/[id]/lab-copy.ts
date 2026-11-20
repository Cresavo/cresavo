import type { Locale } from "@/lib/locale";

// Copy for the legacy local consent lab form. English source, Swedish translation.
const en = {
  missingLink: "The link is invalid, used or expired. Nothing was sent.",
};
const sv: typeof en = {
  missingLink: "Länken är ogiltig, använd eller utgången. Inget skickades.",
};
export const labCopy: Record<Locale, typeof en> = { en, sv };
