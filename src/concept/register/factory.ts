import { connectionError, fail, type AdapterInfo } from "../connections/core";
import type { RegisterPort } from "../connections/ports/register";
import { demoRegister, type RegisterBook } from "../connections/simulated/register";

// The one place a register is handed out. The demo register is for a salon
// that runs on browser state with simulated payments: the sample business or
// a visitor's own trial salon. An owner account, a live payment adapter or a
// live connection gets the unavailable register, whatever the UI shows, so a
// real business can never take payments into it. A certified register
// adapter is added here, behind its own checks.

export interface RegisterContext {
  /** Where the salon lives: browser demo workspaces, or an owner account on the server. */
  workspace: "demo" | "own" | "account";
  /** The payment adapter the salon's online payments resolve to. */
  payments: { info: Pick<AdapterInfo, "provider" | "kind"> };
  /** True when the connection registry resolved payments as live. */
  live?: boolean;
}

export function demoRegisterAllowed({ workspace, payments, live }: RegisterContext): boolean {
  return workspace !== "account" && !live && payments.info.kind === "simulated" && payments.info.provider === "simulated";
}

const unavailable = () => Promise.resolve(fail<never>(connectionError("payments", "register", "not_configured")));

/** A register that refuses everything: no certified register is connected. */
export const unavailableRegister: RegisterPort = {
  info: { provider: "none", kind: "unavailable" },
  startSale: unavailable,
  recordPayment: unavailable,
  completePayment: unavailable,
  refund: unavailable,
  dailyReport: unavailable,
  receipts: () => [],
};

export function createRegister(context: RegisterContext, book?: RegisterBook, save?: (book: RegisterBook) => void): RegisterPort {
  return demoRegisterAllowed(context) ? demoRegister(book, save) : unavailableRegister;
}
