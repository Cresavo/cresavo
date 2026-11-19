import { z } from "zod";
import { applyAction, defaultMeta } from "../log/capture";
import { ToolError, field } from "../tools/define";
import { salonClock } from "../tools/clock";
import { bookingView, buildMove, itemView, proposalView } from "./appointments";
import { jsonValue, pairingDb } from "./db";
import { body, ownerHash, PairError, requirePair, sameOrigin } from "./http";
import { COOKIE } from "./policy";
import { decide } from "./proposals";
import { bump, owner, snapshot, start } from "./workspace";

const headersFor = (id: string, revision: number, expiry: Date) => ({
  ETag: `"pair-${id}-${revision}"`, "X-Pair-Expiry": expiry.toISOString(),
});
export async function session(request: Request) {
  if (!ownerHash(request)) return Response.json(null);
  return pairingDb().$transaction(async tx => {
    const w = await owner(tx, request);
    const headers = headersFor(w.id, w.revision, w.expiresAt);
    if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
    const state = snapshot(await tx.pairWorkspace.findUniqueOrThrow({ where: { id: w.id } }));
    const token = await tx.pairToken.findFirst({ where: { workspaceId: w.id, rotated: false }, select: { clientName: true, scopes: true } });
    const proposals = await tx.pairProposal.findMany({ where: { workspaceId: w.id, status: "pending" }, orderBy: { createdAt: "desc" } });
    const day = salonClock().today;
    return Response.json({ id: w.id, revision: w.revision, expiresAt: w.expiresAt, client: token,
      items: state.inbox.slice(0, 25).map(item => itemView(item, true)),
      bookings: state.bookings.filter(b => b.status === "booked" && b.date >= day).map(b => bookingView(state, b)),
      proposals: proposals.map(proposalView),
    }, { headers });
  });
}

const manage = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start") }), z.strictObject({ action: z.literal("disconnect"), workspaceId: z.uuid() }),
]);
const cookieFlags = "; Path=/; HttpOnly; Secure; SameSite=Lax";
export async function manageSession(request: Request, origin: string) {
  sameOrigin(request, origin);
  const input = manage.parse(JSON.parse(await body(request, "application/json")));
  if (input.action === "disconnect") {
    await pairingDb().$transaction(async tx => {
      const w = await owner(tx, request);
      requirePair(w.id === input.workspaceId, "workspace_changed", 409);
      await tx.pairWorkspace.delete({ where: { id: w.id }, select: { id: true } });
    });
    return new Response(null, { status: 204, headers: { "Set-Cookie": COOKIE + "=; Max-Age=0" + cookieFlags } });
  }
  const token = await pairingDb().$transaction(async tx => {
    if (ownerHash(request)) {
      try { await owner(tx, request); return null; }
      catch (err) { if (!(err instanceof PairError && err.status === 401)) throw err; }
    }
    return start(tx, request);
  });
  return new Response(null, { status: 204, headers: token ? { "Set-Cookie": COOKIE + "=" + token + "; Max-Age=86400" + cookieFlags } : {} });
}

const version = { workspaceId: z.uuid(), revision: z.number().int().positive() };
export async function decision(request: Request, origin: string) {
  sameOrigin(request, origin);
  const input = z.strictObject({ ...version, proposalId: z.uuid(), decision: z.enum(["approve", "decline"]) })
    .parse(JSON.parse(await body(request, "application/json")));
  return pairingDb().$transaction(async tx => {
    const w = await owner(tx, request);
    requirePair(w.id === input.workspaceId, "workspace_changed", 409);
    return Response.json(await decide(tx, w.id, input.revision, input.proposalId, input.decision === "approve"));
  });
}
export async function manualMove(request: Request, origin: string) {
  sameOrigin(request, origin);
  const input = z.strictObject({ ...version, bookingId: z.uuid(), date: z.iso.date(), time: field.time, idempotencyKey: z.uuid() })
    .parse(JSON.parse(await body(request, "application/json")));
  return pairingDb().$transaction(async tx => {
    const w = await owner(tx, request);
    requirePair(w.id === input.workspaceId, "workspace_changed", 409);
    const scoped = { workspaceId: w.id, clientId: "studio", key: input.idempotencyKey };
    const fingerprint = JSON.stringify([input.bookingId, input.date, input.time]);
    const prior = await tx.pairProposal.findUnique({ where: { workspaceId_clientId_key: scoped } });
    if (prior) {
      requirePair(prior.fingerprint === fingerprint, "idempotency_conflict", 409);
      return Response.json({ status: prior.status });
    }
    requirePair(w.revision === input.revision, "refresh_workspace", 409);
    requirePair(await tx.pairProposal.count({ where: { workspaceId: w.id } }) < 50, "proposal_limit", 429);
    const state = snapshot(await tx.pairWorkspace.findUniqueOrThrow({ where: { id: w.id } }));
    try {
      const draft = buildMove(state, input);
      const next = applyAction(state, draft.action, defaultMeta(draft.action, Date.now()));
      requirePair(next !== state, "choose_another_slot", 409);
      await bump(tx, w.id, next);
      await tx.pairProposal.create({ data: { ...scoped, fingerprint, before: {}, draft: jsonValue(draft), status: "applied" } });
      return Response.json({ status: "applied" });
    } catch (err) {
      if (err instanceof ToolError) throw new PairError(409, "choose_another_slot");
      throw err;
    }
  });
}
