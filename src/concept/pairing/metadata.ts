import { pairingIssuer, SCOPES } from "./policy";
export function protectedResource(_request: Request, origin: string) {
  return Response.json({ resource: origin + "/mcp/owner", authorization_servers: [pairingIssuer(origin)],
    scopes_supported: SCOPES, bearer_methods_supported: ["header"] });
}
export function authorizationServer(_request: Request, origin: string) {
  return Response.json({ issuer: pairingIssuer(origin), authorization_response_iss_parameter_supported: true, authorization_endpoint: origin + "/oauth/authorize",
    token_endpoint: origin + "/oauth/token", registration_endpoint: origin + "/oauth/register",
    revocation_endpoint: origin + "/oauth/revoke", token_endpoint_auth_methods_supported: ["none"],
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    client_id_metadata_document_supported: true, code_challenge_methods_supported: ["S256"], scopes_supported: SCOPES });
}
