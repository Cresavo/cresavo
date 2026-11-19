import type { PairGrant } from "@prisma/client";
import { pairingDb, type Tx } from "./db";
import { body, budget, digest, hour, minute, PairError, params, publicBudget, requirePair, secret } from "./http";
import { bump, lockWorkspace, renewWorkspace } from "./workspace";

export function matchesPkce(verifier: string, challenge: string) {
  return /^[\w.~\-]{43,128}$/.test(verifier) && digest(verifier) === challenge;
}

export function sameScopes(granted: string, requested: string) {
  const set = (value: string) => [...new Set(value.split(" ").filter(Boolean))].sort().join(" ");
  return set(granted) === set(requested);
}

async function activeWorkspace(tx: Tx, workspaceId: string, renew = true) {
  try {
    return await lockWorkspace(tx, workspaceId, renew);
  } catch (err) {
    if (err instanceof PairError && err.status === 401) return null;
    throw err;
  }
}

// Callers hold the workspace lock. The tombstone prevents a consumed code issuing again.
export async function revokeGrant(tx: Tx, workspaceId: string, id: string) {
  const changed = await tx.pairGrant.updateMany({ where: { workspaceId, id, revoked: false }, data: { revoked: true } });
  if (changed.count) {
    await tx.pairGrantToken.deleteMany({ where: { grantId: id } });
    await bump(tx, workspaceId);
  }
  return changed.count;
}

async function issue(tx: Tx, grant: PairGrant) {
  const access = secret(), refresh = secret();
  await tx.pairGrantToken.create({ data: {
    grantId: grant.id, accessHash: digest(access), refreshHash: digest(refresh), expiresAt: new Date(Date.now() + 10 * minute),
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
      const workspace = await activeWorkspace(tx, code.workspaceId, false);
      requirePair(workspace, "invalid_grant");
      const prior = await tx.pairGrant.findUnique({ where: { codeHash: hash } });
      if (prior) {
        await revokeGrant(tx, workspace.id, prior.id);
        return null;
      }
      requirePair(code.expiresAt > new Date(), "invalid_grant");
      await renewWorkspace(tx, workspace);
      const grant = await tx.pairGrant.create({ data: {
        workspaceId: workspace.id, subject: "demo-owner:" + workspace.id, clientId: code.clientId,
        clientName: code.clientName, audience, scopes: code.scopes, codeHash: hash,
      } });
      // Keep the PKCE binding for replay detection for the lifetime of the grant.
      await tx.pairCode.update({ where: { hash }, data: { expiresAt: workspace.hardExpiry } });
      await budget(tx, "token:" + grant.id, 60, minute);
      await bump(tx, workspace.id);
      return issue(tx, grant);
    }
    requirePair(q.grant_type === "refresh_token", "unsupported_grant_type");
    requirePair(q.refresh_token, "invalid_grant");
    const where = { refreshHash: digest(q.refresh_token) };
    const prior = await tx.pairGrantToken.findUnique({ where, include: { grant: true } });
    requirePair(prior && prior.grant.clientId === q.client_id && prior.grant.audience === audience, "invalid_grant");
    const grant = prior.grant;
    requirePair(await activeWorkspace(tx, grant.workspaceId), "invalid_grant");
    const current = await tx.pairGrantToken.findUnique({ where });
    requirePair(current, "invalid_grant");
    if (current.rotated) {
      await revokeGrant(tx, grant.workspaceId, grant.id);
      return null;
    }
    requirePair(q.scope === undefined || sameScopes(grant.scopes, q.scope), "invalid_scope");
    await budget(tx, "token:" + grant.id, 60, minute);
    await budget(tx, "refresh:" + grant.id, 360, 24 * hour);
    await tx.pairGrantToken.update({ where, data: { rotated: true } });
    return issue(tx, grant);
  });
  requirePair(result, "invalid_grant");
  return Response.json(result);
}

export async function revoke(request: Request) {
  const q = params(await body(request, "application/x-www-form-urlencoded"));
  requirePair(q.token && q.client_id);
  const hash = digest(q.token);
  const known = await pairingDb().$transaction(async tx => {
    const token = await tx.pairGrantToken.findFirst({ where: { grant: { clientId: q.client_id },
      OR: [{ accessHash: hash }, { refreshHash: hash }] }, include: { grant: true } });
    if (!token || !await activeWorkspace(tx, token.grant.workspaceId)) return false;
    await revokeGrant(tx, token.grant.workspaceId, token.grantId);
    return true;
  });
  if (!known) await publicBudget(request);
  return new Response(null);
}
