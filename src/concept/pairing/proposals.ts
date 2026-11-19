import type { PairProposal } from "@prisma/client";
import { formatTime } from "../data/dates";
import { ToolError, type ChangeDraft } from "../tools/define";
import { applyMove, bookingById, bookingView, buildMove, proposalView, type Move } from "./appointments";
import { jsonValue, type Tx } from "./db";
import { PairError, requirePair } from "./http";
import { legacyServiceId, type PairState } from "./fixture";
import { bump } from "./workspace";

export async function propose(tx: Tx, workspaceId: string, state: PairState, clientId: string, key: string, input: Move) {
  const { bookingId, date, time } = input;
  const fingerprint = JSON.stringify({ bookingId, date, time });
  const scoped = { workspaceId, clientId, key };
  const prior = await tx.pairProposal.findUnique({ where: { workspaceId_clientId_key: scoped } });
  if (prior) {
    requirePair(prior.fingerprint === fingerprint, "idempotency_conflict", 409);
    return proposalView(prior);
  }
  requirePair(await tx.pairProposal.count({ where: { workspaceId } }) < 50, "proposal_limit", 429);
  const draft = buildMove(state, input);
  const before = { bookingVersion: state.bookingVersions?.[bookingId] ?? 0 };
  const row = await tx.pairProposal.create({ data: { ...scoped, fingerprint, before, draft: jsonValue(draft) } });
  await bump(tx, workspaceId);
  return proposalView(row);
}

function matchesBefore(state: PairState, bookingId: string, value: PairProposal["before"]) {
  const before = value as { bookingVersion?: number; date?: string; time?: string; staffId?: string; duration?: number; service?: string };
  const version = state.bookingVersions?.[bookingId] ?? 0;
  if (before.bookingVersion !== undefined) return before.bookingVersion === version;
  // First-generation pending proposals stored the original booking projection.
  const booking = bookingById(state, bookingId);
  const current = bookingView(state, booking);
  return version === 0 && before.date === current.date && before.time === current.time && before.staffId === current.staffId &&
    before.duration === current.duration && typeof before.service === "string" && booking.serviceId === legacyServiceId(before.service);
}

export async function decide(tx: Tx, workspaceId: string, state: PairState, proposalId: string, approve: boolean) {
  const row = await tx.pairProposal.findFirst({ where: { workspaceId, id: proposalId } });
  requirePair(row, "proposal_not_found", 404);
  if (row.status !== "pending") return proposalView(row);
  let next = state;
  let status = "declined";
  if (approve) {
    status = "conflict";
    const { action } = row.draft as unknown as ChangeDraft;
    requirePair(action.type === "booking/move", "unsupported_proposal", 409);
    try {
      if (matchesBefore(state, action.id, row.before)) {
        const input = { bookingId: action.id, date: action.date, time: formatTime(action.start) };
        const draft = buildMove(state, input);
        next = applyMove(state, draft.action, { at: Date.now(), actor: "ai", source: "mcp" });
        if (next !== state) status = "applied";
      }
    } catch (err) {
      if (!(err instanceof ToolError || err instanceof PairError)) throw err;
    }
  }
  const decided = await tx.pairProposal.update({ where: { id: row.id }, data: { status } });
  await bump(tx, workspaceId, next !== state ? next : undefined);
  return proposalView(decided);
}
