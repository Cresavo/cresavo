"use client";

import { useEffect } from "react";
import { staffViewer } from "../../ops/access";
import { useRole } from "../../ops/role";
import { journalsOnServer } from "../../account/sync";
import { currentState, currentTarget, dispatch } from "../../store";

/**
 * Renders nothing. Mounted next to journal text, it logs that this reader opened
 * this customer's journal: who, when and whose, never the content
 * (`journal/view`, shown to the owner under Privacy). The same reader opening it
 * again within a minute counts once.
 */
export function JournalRead({ customerId, loggedByServer = false }: { customerId: string; loggedByServer?: boolean }) {
  const role = useRole();
  useEffect(() => {
    // The server logs each read where it hands out the text (JOURNALS_ON_SERVER) and refuses reads a studio reports.
    if (loggedByServer || journalsOnServer()) return;
    const state = currentState();
    // An account salon's server attributes reads to the signed-in owner; the demo's Owner / Staff switch only applies to browser salons.
    const staff = role === "staff" && state && currentTarget()?.workspace !== "account" ? staffViewer(state) : null;
    dispatch({ type: "journal/view", customerId, actor: staff ? "staff" : "owner", ...(staff ? { staffId: staff.id } : {}) });
  }, [customerId, role, loggedByServer]);
  return null;
}
