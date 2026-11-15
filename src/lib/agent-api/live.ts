import { DateTime } from "luxon";
import { db } from "../db";
import { DEMO_BUSINESS_ID } from "../config";
import { ZONE } from "../time";

// Public, read-only sandbox feed. Only allow-listed fields: agent label,
// provenance, action, outcome, service, staff first name and slot time.
// Never customer names/emails, owner contact, key material or raw request logs.
export type LiveEvent = {
  id: string;
  at: string;
  agentName: string;
  provenance: "demo-script" | "registered-client" | "verified-agent-proof";
  action: "book" | "cancel";
  outcome: string;
  serviceName: string | null;
  staffName: string | null;
  slot: string | null;
};
export type LiveSnapshot = {
  generatedAt: string;
  timeZone: string;
  stats: { booked: number; conflictsHandled: number; cancelled: number; activeKeys: number };
  byProvenance: Record<LiveEvent["provenance"], number>;
  events: LiveEvent[];
};

const PROVENANCE = new Set(["demo-script", "registered-client", "verified-agent-proof"]);
const iso = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toISO({ suppressMilliseconds: true })!;

export async function liveSnapshot(limit = 30): Promise<LiveSnapshot> {
  const where = { businessId: DEMO_BUSINESS_ID };
  const [rows, grouped, keys] = await Promise.all([
    db.agentApiEvent.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit }),
    db.agentApiEvent.groupBy({ by: ["outcome"], where, _count: { _all: true } }),
    db.agentApiEvent.groupBy({ by: ["keyId"], where }),
  ]);
  const keyRows = await db.agentApiKey.findMany({
    where: { id: { in: [...new Set([...rows.map((r) => r.keyId), ...keys.map((k) => k.keyId)])] } },
    select: { id: true, agentName: true, kind: true },
  });
  const byId = new Map(keyRows.map((k) => [k.id, k]));
  const count = (o: string) => grouped.find((g) => g.outcome === o)?._count._all ?? 0;
  const byProvenance = { "demo-script": 0, "registered-client": 0, "verified-agent-proof": 0 };
  for (const k of keys) {
    const kind = byId.get(k.keyId)?.kind;
    if (kind && PROVENANCE.has(kind)) byProvenance[kind as LiveEvent["provenance"]]++;
  }
  return {
    generatedAt: iso(new Date()),
    timeZone: ZONE,
    stats: { booked: count("booked"), conflictsHandled: count("conflict"), cancelled: count("cancelled"), activeKeys: keys.length },
    byProvenance,
    events: rows.map((r) => {
      const key = byId.get(r.keyId);
      return {
        id: r.id,
        at: iso(r.createdAt),
        agentName: key?.agentName ?? "Unknown key",
        provenance: (key && PROVENANCE.has(key.kind) ? key.kind : "registered-client") as LiveEvent["provenance"],
        action: r.action as LiveEvent["action"],
        outcome: r.outcome,
        serviceName: r.serviceName,
        staffName: r.staffName,
        slot: r.startsAt ? iso(r.startsAt) : null,
      };
    }),
  };
}
