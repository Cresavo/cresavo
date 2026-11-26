"use client";

import { useSyncExternalStore } from "react";
import type { ReceptionistStatus } from "../../receptionist/server/config";
import { useActiveWorkspace } from "../../store";

// Whether this deployment has the phone receptionist switched on. Asked once
// per page load; "off" until the answer is in and when the server cannot say.

type Answer = ReceptionistStatus | "loading" | "unknown";

let answer: Answer = "loading";
let asked = false;
const listeners = new Set<() => void>();

async function read(): Promise<Answer> {
  try {
    const response = await fetch("/api/concept/receptionist", { cache: "no-store" });
    return response.ok ? ((await response.json()) as ReceptionistStatus) : "unknown";
  } catch {
    return "unknown";
  }
}

function ask() {
  if (asked) return;
  asked = true;
  void read().then((status) => {
    answer = status;
    listeners.forEach((listener) => listener());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ask();
  return () => {
    listeners.delete(listener);
  };
}

/** The server's answer, "loading" before it, "unknown" when it could not be read. */
export function useReceptionistStatus(): Answer {
  return useSyncExternalStore(subscribe, () => answer, () => "loading" as const);
}

/** True when the receptionist's page belongs in the menu: switched on, and the sample salon is open. */
export function useReceptionistAvailable(): boolean {
  const status = useReceptionistStatus();
  const workspace = useActiveWorkspace();
  return typeof status === "object" && status.enabled && workspace === "demo";
}
