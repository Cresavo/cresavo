"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DemoState } from "./data/types";

// A salon the server sent to the booking pages (`publicSalonView`), instead of
// the browser's own copy. Without a provider the pages run on browser state as
// in the demo.

const ServerSalon = createContext<DemoState | null>(null);

export const useServerSalon = () => useContext(ServerSalon);

export function ServerSalonProvider({ state, children }: { state: DemoState; children: ReactNode }) {
  return <ServerSalon.Provider value={state}>{children}</ServerSalon.Provider>;
}
