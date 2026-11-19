import { randomUUID } from "node:crypto";
import type { PairCode, PairToken } from "@prisma/client";
import { pairingDb, type Tx } from "./db";
import { body, budget, digest, hour, minute, PairError, params, requirePair, secret } from "./http";
import { bump, lockWorkspace } from "./workspace";

export function matchesPkce(verifier: string, challenge: string) {
  return /^[\w.~\-]{43,128}$/.test(verifier) && digest(verifier) === challenge;
}

async function activeGrant(tx: Tx, workspaceId: string) {
  try {
    await lockWorkspace(tx, workspaceId);
  } catch (err) {
    if (err instanceof PairError && err.status === 401) return false;
    throw err;
  }
  return true;
}

async function issue(tx: Tx, grant: PairCode | PairToken, family: string) {
  const access = secret(), refresh = secret();
  await tx.pairToken.create({ data: {
    workspaceId: grant.workspaceId, clientId: grant.clientId, clientName: grant.clientName,
    scopes: grant.scopes, audience: grant.audience, family, accessHash: digest(access), refreshHash: digest(refresh),
    expiresAt: new Date(Date.now() + 10 * minute),
  } });
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 600, scope: grant.scopes };
}

export async function token(request: Request, origin: string) {
  const q = params(await body(request, "application/x-www-form-urlencoded"));
  const audience = origin + "/mcp/owner";
  requirePair((q.resource ?? audience) === audience, "invalid_target");
  requirePair(q.client_id && !request.headers.has("authorization"), "invalid_client");
  const result = await pairingDb().$transaction(async tx => {
    if (q.grant_type === "authorization_code") {
      requirePair(q.code && q.code_verifier && q.redirect_uri, "invalid_grant");
      const hash = digest(q.code);
      const code = await tx.pairCode.findUnique({ where: { hash } });
      requirePair(code && !code.consent && code.clientId === q.client_id && code.audience === audience &&
        code.redirectUri === q.redirect_uri && matchesPkce(q.code_verifier, code.challenge), "invalid_grant");
      requirePair(await activeGrant(tx, code.workspaceId), "invalid_grant");
      const consumed = await tx.pairCode.deleteMany({ where: { hash, expiresAt: { gt: new Date() } } });
      requirePair(consumed.count === 1, "invalid_grant");
      await tx.pairToken.deleteMany({ where: { workspaceId: code.workspaceId } });
      await bump(tx, code.workspaceId);
      return issue(tx, code, randomUUID());
    }
    requirePair(q.grant_type === "refresh_token", "unsupported_grant_type");
    requirePair(q.refresh_token, "invalid_grant");
    const where = { refreshHash: digest(q.refresh_token) };
    const prior = await tx.pairToken.findUnique({ where });
    requirePair(prior && prior.clientId === q.client_id && prior.audience === audience, "invalid_grant");
    requirePair(q.scope === undefined || prior.scopes === q.scope, "invalid_scope");
    requirePair(await activeGrant(tx, prior.workspaceId), "invalid_grant");
    const current = await tx.pairToken.findUnique({ where });
    requirePair(current, "invalid_grant");
    if (current.rotated) {
      // Commit reuse detection before returning the protocol error.
      await tx.pairToken.deleteMany({ where: { family: current.family } });
      await bump(tx, prior.workspaceId);
      return null;
    }
    await budget(tx, "refresh:" + current.workspaceId, 360, 24 * hour);
    await tx.pairToken.update({ where, data: { rotated: true } });
    return issue(tx, current, current.family);
  });
  requirePair(result, "invalid_grant");
  return Response.json(result);
}

export async function revoke(request: Request) {
  const q = params(await body(request, "application/x-www-form-urlencoded"));
  requirePair(q.token && q.client_id);
  const hash = digest(q.token);
  await pairingDb().$transaction(async tx => {
    const token = await tx.pairToken.findFirst({ where: { clientId: q.client_id, OR: [{ accessHash: hash }, { refreshHash: hash }] } });
    if (token && await activeGrant(tx, token.workspaceId)) {
      await tx.pairToken.deleteMany({ where: { family: token.family } });
      await bump(tx, token.workspaceId);
    }
  });
  return new Response(null);
}
