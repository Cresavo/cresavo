"use client";

import { useEffect, useState } from "react";
import { journalSessionKey, readCustomerJournals } from "../../account/sync";
import type { JournalEntry } from "../../data/types";
import { isStub } from "../../journals/sealed";

/** A customer's journal as the studio shows it. `fromServer`: the server read (and logged) it for this page. */
export interface ShownJournal {
  entries: JournalEntry[];
  loading: boolean;
  failed: boolean;
  fromServer: boolean;
  retry: () => void;
}

/**
 * The customer's entries with their text. A signed-in salon whose server keeps journals (JOURNALS_ON_SERVER)
 * holds stubs only: their text is fetched when the page opens and again whenever a stub's versions change, and
 * the server logs each read. Entries that still carry text (the demo, a browser salon, a change not yet answered)
 * are shown as they are.
 */
export function useServerJournal(customerId: string, entries: JournalEntry[]): ShownJournal {
  const stubs = entries.filter(isStub);
  const signature = stubs.map((entry) => `${entry.id}:${entry.sealed!.versions.join(".")}`).join("|");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; entries: Map<string, JournalEntry> | null } | null>(null);
  // Text read for another session (an account switch, a sign-out) is never shown: the key changes with the session.
  const key = `${journalSessionKey()}|${customerId}|${signature}|${attempt}`;

  useEffect(() => {
    if (!signature) return;
    let live = true;
    void readCustomerJournals(customerId).then((read) => {
      if (live) setLoaded({ key, entries: read ? new Map(read.map((entry) => [entry.id, entry])) : null });
    });
    return () => { live = false; };
  }, [customerId, signature, key]);

  const retry = () => setAttempt((n) => n + 1);
  if (!signature) return { entries, loading: false, failed: false, fromServer: false, retry };
  const current = loaded?.key === key ? loaded : null;
  const shown = entries.flatMap((entry) => {
    if (!isStub(entry)) return [entry];
    const full = current?.entries?.get(entry.id);
    return full ? [full] : [];
  });
  return { entries: shown, loading: !current, failed: !!current && !current.entries, fromServer: true, retry };
}
