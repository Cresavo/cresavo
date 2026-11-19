import { describe, expect, it } from "vitest";
import { en } from "@/concept/i18n/en";
import { sv } from "@/concept/i18n/sv";

// Salon owners are not technical. Studio text outside Advanced must not use developer words.
// The words come from the UI review checklist in docs/design/DESIGN_SYSTEM.md.
const JARGON = /\b(MCP|APIs?|CSV|slugs?|localhost|tokens?|UTC|CSS|iframes?|SIE)\b/i;

/**
 * Dictionary keys that are only shown under More → Settings → Advanced (or its developer page), where
 * technical words are allowed. Keep this list explicit: add a prefix only when its screen lives in Advanced.
 */
export const ADVANCED_KEY_PREFIXES = [
  "pair.", // pairing an outside assistant (developer page and pairing deployments)
  "ai.", // AI tasks, models, own keys and the cost log (developer page)
  "data.connect", // connecting Claude or ChatGPT (developer page)
  "data.endpoint",
  "data.copyEndpoint",
  "data.token.",
  "data.setup.",
  "data.protocol.", // the protocol table (developer page)
  "pageEditor.css.", // own styling for the booking page (Advanced)
] as const;

/** Help search keywords are matched against questions and never shown, so owners may type the words they know. */
const shown = (key: string) => !key.endsWith(".keywords");

const allowed = (key: string) => ADVANCED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

describe("no developer jargon in the default studio", () => {
  for (const [language, dictionary] of [["en", en.messages], ["sv", sv.messages]] as const) {
    it(`${language}: primary screens use plain words`, () => {
      const found = Object.entries(dictionary)
        .filter(([key]) => shown(key) && !allowed(key))
        .filter(([, value]) => JARGON.test(String(value)))
        .map(([key, value]) => `${key}: ${String(value).match(JARGON)?.[0]}`);
      expect(found).toEqual([]);
    });
  }

  it("keeps every allowlisted prefix in use, so the list stays honest", () => {
    const keys = Object.keys(en.messages);
    for (const prefix of ADVANCED_KEY_PREFIXES) expect(keys.some((key) => key.startsWith(prefix)), prefix).toBe(true);
  });

  it("catches the words it is meant to catch", () => {
    for (const text of ["Copy the MCP address", "Your API key", "Customers (CSV)", "Your slug", "kajsa.localhost", "Demo token", "Totals (UTC)", "Own CSS", "<iframe>", "SIE file"]) {
      expect(JARGON.test(text), text).toBe(true);
    }
    for (const text of ["Your booking link", "Download my data", "Rapid booking", "Capital"]) expect(JARGON.test(text), text).toBe(false);
  });
});
