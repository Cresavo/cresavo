import type { PairToken, PairWorkspace } from "@prisma/client";
import { applyAction } from "../log/capture";
import { ToolError } from "../tools/define";
import { bookingById, bookingView, buildMove, proposalView, type Move } from "./appointments";
import { jsonValue, type Tx } from "./db";
import { PairError, requirePair } from "./http";
import { bump, snapshot } from "./workspace";

export async function propose(tx: Tx, w: PairWorkspace, grant: PairToken, key: string, input: Move) {
  const { bookingId, date, time } = input;
  const fingerprint = JSON.stringify({ bookingId, date, time });
  const scoped = { workspaceId: w.id, clientId: grant.clientId, key };
  const prior = await tx.pairProposal.findUnique({ where: { workspaceId_clientId_key: scoped } });
  if (prior) {
    requirePair(prior.fingerprint === fingerprint, "idempotency_conflict", 409);
    return proposalView(prior);
  }
  requirePair(await tx.pairProposal.count({ where: { workspaceId: w.id } }) < 50, "proposal_limit", 429);
  const state = snapshot(w);
  const draft = buildMove(state, input);
  const before = bookingView(state, bookingById(state, bookingId));
  const row = await tx.pairProposal.create({ data: { ...scoped, fingerprint, before, draft: jsonValue(draft) } });
  await bump(tx, w.id);
  return proposalView(row);
}

export async function decide(tx: Tx, workspaceId: string, revision: number, proposalId: string, approve: boolean) {
  const row = await tx.pairProposal.findFirst({ where: { workspaceId, id: proposalId } });
  requirePair(row, "proposal_not_found", 404);
  if (row.status !== "pending") return proposalView(row);
  const w = await tx.pairWorkspace.findUniqueOrThrow({ where: { id: workspaceId } });
  requirePair(w.revision === revision, "refresh_workspace", 409);
  const state = snapshot(w);
  let next = state;
  let status = "declined";
  if (approve) {
    status = "conflict";
    const input = JSON.parse(row.fingerprint) as Move;
    const before = row.before as ReturnType<typeof bookingView>;
    try {
      const current = bookingView(state, bookingById(state, input.bookingId));
      if (before.date === current.date && before.time === current.time && before.staffId === current.staffId &&
          before.duration === current.duration && before.service === current.service) {
        const draft = buildMove(state, input);
        next = applyAction(state, draft.action, { at: Date.now(), actor: "ai", source: "mcp" });
        if (next !== state) status = "applied";
      }
    } catch (err) {
      if (!(err instanceof ToolError || err instanceof PairError)) throw err;
    }
  }
  const decided = await tx.pairProposal.update({ where: { id: row.id }, data: { status } });
  await bump(tx, w.id, next !== state ? next : undefined);
  return proposalView(decided);
}
