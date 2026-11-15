// Exercise the public route-handler chain under the integration DB guard too.
// OAuth lab state itself is deliberately process-local and never writes domain data.
import { labRequest } from "../oauth.test";
import { expect, it } from "vitest";
import { GET as mcp } from "../../src/app/api/v1/mcp/route";
import { POST as register } from "../../src/app/register/route";
it("OAuth does not replace existing MCP key authentication", async () => {
  const response = await mcp(new Request("http://127.0.0.1/api/v1/mcp", {headers:{authorization:"Bearer synthetic-oauth-token"}}));
  expect(response.status).toBe(401);
});
it("registration rejects unsafe redirect and confidential authentication", async () => {
  for (const metadata of [{redirect_uris:["javascript:alert(1)"]},{redirect_uris:["https://client.example.test/cb"],token_endpoint_auth_method:"client_secret_basic"}]) {
    const response = await register(labRequest("http://127.0.0.1/register", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(metadata)}));
    expect(response.status).toBe(400);
  }
});
