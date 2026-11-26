import { t, type MessageKey } from "../i18n";

// Messages for when something did not work or is missing, written for a beginner: what happened in plain words,
// why when that helps, and one clear next step. Error codes and stack text never reach the screen; pass them to
// `logForSupport`. Style rules and examples: docs/design/FRIENDLY_ERRORS.md.

export interface FriendlyMessage {
  what: string;
  why?: string;
  next: string;
  /** A help-map id: "Show me" points at the place where this is fixed. */
  showMe?: string;
}

type Vars = Record<string, string | number>;

/** Builds a friendly message from dictionary keys. */
export function friendlyMessage(keys: { what: MessageKey; why?: MessageKey; next: MessageKey; showMe?: string }, vars?: Vars): FriendlyMessage {
  return {
    what: t(keys.what, vars),
    why: keys.why && t(keys.why, vars),
    next: t(keys.next, vars),
    showMe: keys.showMe,
  };
}

/** The whole message as one line, for a toast or a screen reader announcement. */
export function friendlyText(message: FriendlyMessage): string {
  return [message.what, message.why, message.next].filter(Boolean).join(" ");
}

/** Keeps the technical detail for support in the browser console, where the owner never has to read it. */
export function logForSupport(code: string, error?: unknown): void {
  console.warn(`[${code}]`, error ?? "");
}
