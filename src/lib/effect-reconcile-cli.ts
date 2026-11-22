import { parseArgs } from "node:util";

// The command line of `npm run effects:reconcile` (scripts/reconcile-effects.mts):
// what an operator asked for, and how a row is shown without its content. No
// database here, so it is tested on its own.

export type ReconcileAction = "retry" | "mark-sent" | "mark-failed";

export type ReconcileCommand =
  | { command: "list"; tenant?: string; limit: number }
  | { command: ReconcileAction; ids: string[]; tenant: string; apply: boolean; forceMaybeDuplicate: boolean; actor: string };

export type ParsedArgs = ReconcileCommand | { error: string };

export const USAGE = `Usage: npm run effects:reconcile -- <command> [options]

  list [--tenant <id>] [--limit 200]       failed and uncertain effects, per tenant
  retry <id...> --tenant <id>              a failed e-mail back to pending, with a fresh budget;
        [--force-maybe-duplicate]          only if it never left, unless forced
  mark-sent <id...> --tenant <id>          an uncertain e-mail the provider shows as sent
  mark-failed <id...> --tenant <id>        an uncertain e-mail the provider shows as not sent

  Changes nothing without --apply. --actor <id> (a short lower-case id such as initials) names who acts.`;

const ACTIONS: readonly ReconcileAction[] = ["retry", "mark-sent", "mark-failed"];
/** Effect and tenant ids as the store makes them; anything else is a typo or worse. */
const ID = /^[A-Za-z0-9_.:-]{1,200}$/;
/** An opaque operator id (initials, a short staff number), never a name, an e-mail address or a phone number. */
const ACTOR = /^[a-z0-9_-]{1,32}$/;
const opaqueActor = (value: string) => ACTOR.test(value) && !/\d{6,}/.test(value);
const MAX_IDS = 100;
const MAX_LIMIT = 1000;

export function parseReconcileArgs(argv: readonly string[], env: { USER?: string } = {}): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        tenant: { type: "string" },
        limit: { type: "string" },
        apply: { type: "boolean", default: false },
        "force-maybe-duplicate": { type: "boolean", default: false },
        actor: { type: "string" },
      },
    });
  } catch {
    return { error: "unknown_option" };
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  const tenant = values.tenant;
  if (tenant !== undefined && !ID.test(tenant)) return { error: "invalid_tenant" };

  if (command === "list") {
    if (rest.length) return { error: "list_takes_no_ids" };
    if (values.apply || values["force-maybe-duplicate"]) return { error: "list_changes_nothing" };
    const limit = values.limit === undefined ? 200 : Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { error: "invalid_limit" };
    return { command: "list", ...(tenant ? { tenant } : {}), limit };
  }
  if (!ACTIONS.includes(command as ReconcileAction)) return { error: "unknown_command" };
  const action = command as ReconcileAction;
  if (values.limit !== undefined) return { error: "limit_is_for_list" };
  const ids = [...new Set(rest)];
  if (!ids.length) return { error: "no_ids" };
  if (ids.length > MAX_IDS) return { error: "too_many_ids" };
  if (!ids.every((id) => ID.test(id))) return { error: "invalid_id" };
  // Every change names its tenant, so an id copied from another salon's list is refused, not acted on.
  if (!tenant) return { error: "tenant_required" };
  if (values["force-maybe-duplicate"] && action !== "retry") return { error: "force_is_for_retry" };
  if (values.actor !== undefined && !opaqueActor(values.actor)) return { error: "invalid_actor" };
  const actor = values.actor ?? (env.USER && opaqueActor(env.USER) ? env.USER : "operator");
  return { command: action, ids, tenant, apply: values.apply, forceMaybeDuplicate: values["force-maybe-duplicate"], actor };
}

/** An address shown as its domain only: `***@example.test`. Anything that is not an address shows as `-`. */
export function maskAddress(address: string | undefined): string {
  const at = address?.lastIndexOf("@") ?? -1;
  const domain = at > 0 ? address!.slice(at + 1).trim().toLowerCase() : "";
  return /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain) ? `***@${domain}` : "-";
}

/** A duration as its two largest units: `45s`, `12m`, `3h12m`, `2d4h`. */
export function formatAge(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "-";
  const s = Math.floor(ms / 1000);
  const [d, h, m] = [Math.floor(s / 86_400), Math.floor((s % 86_400) / 3600), Math.floor((s % 3600) / 60)];
  if (d) return `${d}d${h}h`;
  if (h) return `${h}h${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

/** One listed row, already free of content: what `formatList` prints. */
export interface ListedEffect {
  id: string;
  tenantId: string;
  kind: string;
  state: "failed" | "uncertain";
  ageMs?: number;
  attempts: number;
  error?: string;
  dispatched: boolean;
  reconciled?: string;
  recipient: string;
}

/** The rows grouped per tenant, one line each. */
export function formatList(rows: readonly ListedEffect[]): string[] {
  if (!rows.length) return ["No failed or uncertain effects."];
  const lines: string[] = [];
  let tenant: string | undefined;
  for (const row of rows) {
    if (row.tenantId !== tenant) {
      tenant = row.tenantId;
      lines.push(`tenant ${tenant}`);
    }
    lines.push([
      `  ${row.id}`, row.kind, row.state, `age ${formatAge(row.ageMs)}`, `attempts ${row.attempts}`, `error ${row.error ?? "-"}`,
      row.dispatched ? "dispatched" : "not-dispatched", ...(row.reconciled ? [`reconciled ${row.reconciled}`] : []), `to ${row.recipient}`,
    ].join("  "));
  }
  return lines;
}
