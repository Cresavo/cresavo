"use client";

import { useEffect } from "react";
import { staffViewer } from "../../ops/access";
import { useRole } from "../../ops/role";
import { currentState, dispatch } from "../../store";

/**
 * Renders nothing. Mounted next to journal text, it logs that this reader opened
 * this customer's journal: who, when and whose, never the content
 * (`journal/view`, shown to the owner under Privacy). The same reader opening it
 * again within a minute counts once.
 */
export function JournalRead({ customerId }: { customerId: string }) {
  const role = useRole();
  useEffect(() => {
    const state = currentState();
    const staff = role === "staff" && state ? staffViewer(state) : null;
    dispatch({ type: "journal/view", customerId, actor: staff ? "staff" : "owner", ...(staff ? { staffId: staff.id } : {}) });
  }, [customerId, role]);
  return null;
}
