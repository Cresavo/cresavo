import { productDomain } from "./address";

// Own domain (level 3). The business adds one DNS record at its domain
// provider; the platform then verifies it and issues the certificate. The demo
// simulates the three steps; `server/vercel-domains.ts` does it for real when
// switched on, and reports into the same statuses.

/** Where an own domain's CNAME record must point. */
export const CNAME_TARGET = "cname.vercel-dns.com";

/** waiting-dns: the record is missing or wrong. verifying: found, certificate on its way. secure: live over HTTPS. */
export type DomainStatus = "waiting-dns" | "verifying" | "secure";

export const DOMAIN_STEPS: readonly DomainStatus[] = ["waiting-dns", "verifying", "secure"];

export interface DomainConnection {
  host: string;
  status: DomainStatus;
}

export type DomainProblem = "empty" | "format" | "address" | "apex" | "product";

export type DomainCheck = { ok: true; host: string } | { ok: false; problem: DomainProblem };

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** "https://Boka.SalongEko.se/" becomes "boka.salongeko.se". Only subdomains: an apex domain cannot carry a CNAME. */
export function checkDomain(input: string, product = productDomain()): DomainCheck {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  if (!host) return { ok: false, problem: "empty" };
  const labels = host.split(".");
  if (labels.length > 1 && labels.every((label) => /^\d+$/.test(label))) return { ok: false, problem: "address" };
  if (labels.length < 2 || host.length > 253 || !labels.every((label) => LABEL.test(label)) || !/^[a-z]{2,}$/.test(labels.at(-1)!)) return { ok: false, problem: "format" };
  if (host === product || host.endsWith(`.${product}`)) return { ok: false, problem: "product" };
  if (labels.length < 3) return { ok: false, problem: "apex" };
  return { ok: true, host };
}

export interface DnsInstruction {
  type: "CNAME";
  /** Absolute DNS name, including the trailing dot. */
  name: string;
  host: string;
  value: string;
}

export function dnsInstruction(host: string): DnsInstruction {
  return { type: "CNAME", name: `${host}.`, host, value: CNAME_TARGET };
}

/** One check later: the simulation moves a step on; the last step stays. */
export function advanceStatus(status: DomainStatus): DomainStatus {
  return DOMAIN_STEPS[Math.min(DOMAIN_STEPS.indexOf(status) + 1, DOMAIN_STEPS.length - 1)];
}
