import type { TranscriptLine } from "../../receptionist/types";

/** Swedish fixture lines for local screenshots only. */
export const PREVIEW_LINES: TranscriptLine[] = [
  { who: "receptionist", text: "Hej och välkommen till Salong Eko, det är Maja som svarar. Hur kan jag hjälpa dig?", at: 2 },
  { who: "caller", text: "Hej, jag vill boka en pedikyr nästa vecka.", at: 8 },
  { who: "receptionist", text: "Absolut. Jag har tisdag klockan 14:00 med Elin, 45 minuter för 650 kronor. Ska jag boka den tiden?", at: 16 },
  { who: "caller", text: "Ja, tack. Anna Berg, 0701234567.", at: 24 },
  { who: "receptionist", text: "Då är tiden bokad. Du får en bekräftelse på SMS och e-post. Något mer jag kan hjälpa dig med?", at: 32 },
];

export const PREVIEW_HANDOVER = "Anna vill boka en tid som inte finns online. Ring henne på 0701234567.";
