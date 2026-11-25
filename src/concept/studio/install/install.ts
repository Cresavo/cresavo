"use client";

import { useSyncExternalStore } from "react";

/** The browser's own install dialog, held back until the owner asks for it (Chrome, Edge, Samsung Internet). */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How this browser adds the studio to the home screen: its own dialog, Safari's Share menu, or not at all. */
export type InstallWay = "prompt" | "ios" | null;

export function installWay({ standalone, prompt, ios }: { standalone: boolean; prompt: boolean; ios: boolean }): InstallWay {
  if (standalone) return null;
  if (prompt) return "prompt";
  return ios ? "ios" : null;
}

/** iPhone and iPad, including an iPad that presents itself as a Mac. */
export function isAppleTouch(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}

let deferred: InstallPrompt | null = null;
let watching = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());

/**
 * Keep the browser's install offer for the row under More instead of letting it pop up by itself. Started by the
 * studio's shell only: the booking pages carry no platform manifest and never offer to install the studio.
 */
export function watchInstall() {
  if (watching) return;
  watching = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    publish();
  });
}

function currentWay(): InstallWay {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return installWay({ standalone, prompt: !!deferred, ios: isAppleTouch(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) });
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, currentWay, () => null);
}

/** Open the browser's install dialog. The offer can be used once; after it the row goes. */
export async function promptInstall() {
  const offer = deferred;
  if (!offer) return;
  deferred = null;
  await offer.prompt();
  publish();
}
