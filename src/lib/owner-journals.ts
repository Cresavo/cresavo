import type { DemoState } from "../concept/data/types";
import { withoutJournalText } from "../concept/journals/sealed";
import { journalKey } from "../concept/store/journal-crypto";
import { JournalVault } from "../concept/store/journal-vault";

// Server-side journals for account salons (docs/design/STUDIO_STORE.md, "Server-side journals"). Off unless
// JOURNALS_ON_SERVER=1, which requires JOURNAL_ENCRYPTION_KEY (`v1:` and 32 bytes of base64). With the flag on
// and no valid key, the journal routes answer 503 and the salon is served without journal text: nothing falls
// back to plaintext. With the flag off, every owner route behaves as before. The demo never reaches this code.

/** True when the operator switched server-side journals on. */
export const journalsOnServer = () => process.env.JOURNALS_ON_SERVER === "1";

/** What the owner store keeps journals with: the vault, "unavailable" without a key, or undefined when the flag is off. */
export function journalStoreOption(): JournalVault | "unavailable" | undefined {
  if (!journalsOnServer()) return undefined;
  const key = journalKey();
  return key ? new JournalVault(key) : "unavailable";
}

/**
 * The journal key for erasure, whatever the flag says: a salon with encrypted journal rows (the flag was on, or a
 * restore brought them back) is only erased with it. Undefined without a valid key.
 */
export function erasureJournalVault(): JournalVault | undefined {
  const key = journalKey();
  return key ? new JournalVault(key) : undefined;
}

/** The salon as a browser may receive it: with the flag on, no journal entry that carries text. */
export const salonForBrowser = (state: DemoState): DemoState => (journalsOnServer() ? withoutJournalText(state) : state);
