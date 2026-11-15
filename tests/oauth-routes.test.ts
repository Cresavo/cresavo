import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { accessToken, origin, rpcBody } from "./helpers/oauth";
import { GET as services } from "../src/app/api/v1/services/route";
import { GET as bookingStatus } from "../src/app/api/v1/bookings/[id]/route";
import { POST as mcp } from "../src/app/api/v1/mcp/route";
import { authenticateAgent } from "../src/lib/agent-api/keys";
import { db } from "../src/lib/db";

const audit = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/agent-api/audit", () => ({ auditContext: (run: () => unknown) => run(), recordAudit: audit }));
const fixture = vi.hoisted(() => ({ active: true, revoked: false }));
vi.mock("../src/lib/db", () => ({ db: {
  agentApiKey: { upsert: async ({create}: {create:{keyPrefix:string;agentName:string;ownerName:string;kind:string}}) => ({...create,id:`key-${create.keyPrefix}`,clientId:create.keyPrefix,businessId:"demo",client:{active:fixture.active},revokedAt:fixture.revoked ? new Date() : null}) },
  service: {findMany:async()=>[{id:"massage",name:"Massage",duration:30,buffer:0,priceOre:45000,version:1}]},
  staff: {findMany:async()=>[]},
} }));
beforeEach(()=>{
  audit.mockClear();
  fixture.active=true; fixture.revoked=false;
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN",origin); vi.stubEnv("BOOKING_OAUTH_LAB","1"); vi.stubEnv("BOOKING_RUNTIME","local");
  vi.stubEnv("BOOKING_ADDRESS_SECRET","synthetic-oauth-socket-proof"); vi.stubEnv("RATE_LIMIT_STORE","memory");
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const headers = (token: string) => new Headers({authorization:`Bearer ${token}`});
const call = (token: string, name: string) => mcp(new Request(`${origin}/api/v1/mcp`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json",accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:{business:"demo"}}})}));
it("serves REST and MCP using the real OAuth verifier and route chain with synthetic storage",async()=>{
  const log=vi.spyOn(console,"info").mockImplementation(()=>{});
  const t = await accessToken();
  const rest = await services(new Request(`${origin}/api/v1/services?business=demo`,{headers:headers(t)}));
  expect(rest.status).toBe(200); expect((await rest.json()).services[0].id).toBe("massage");
  const rpc = await call(t,"list_services"); expect(rpc.status).toBe(200);
  expect((await rpcBody(rpc)).result.structuredContent.services[0].id).toBe("massage");
  expect(JSON.stringify(log.mock.calls)).not.toContain(t);
  const events = audit.mock.calls.map(c => c[0]);
  expect(events).toContainEqual(expect.objectContaining({ event: "agent.request", tool: "list_services", outcome: "success", scopes: expect.arrayContaining(["services:read"]) }));
  expect(events).toContainEqual(expect.objectContaining({ event: "agent.request", route: "GET /api/v1/services", outcome: "200" }));
  expect(JSON.stringify(events)).not.toContain(t);
});
it("keeps client identity stable across token requests and separates registered clients",async()=>{
  const a=await accessToken(),b=await accessToken();
  const p=await authenticateAgent(headers(a),db,"services:read");
  expect((await authenticateAgent(headers(a),db,"services:read")).clientId).toBe(p.clientId);
  expect((await authenticateAgent(headers(b),db,"services:read")).clientId).not.toBe(p.clientId);
});
it("rejects disabled and revoked client mappings",async()=>{
  const t=await accessToken();
  fixture.active=false;
  expect((await services(new Request(`${origin}/api/v1/services`,{headers:headers(t)}))).status).toBe(401);
  fixture.active=true;fixture.revoked=true;
  expect((await services(new Request(`${origin}/api/v1/services`,{headers:headers(t)}))).status).toBe(401);
});
it("returns HTTP 403 and insufficient_scope before an MCP tool executes",async()=>{
  const t=await accessToken("services:read");
  for(const name of ["get_availability","create_booking","get_booking","cancel_booking","usp_bookings_get"]) {
    const r=await call(t,name); expect(r.status).toBe(403);
    expect(r.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    expect((await r.json()).error.code).toBe("forbidden_scope");
  }
});
it("returns metadata challenges without trusting attacker Host",async()=>{
  const r=await services(new Request("http://evil.example.test/api/v1/services",{headers:{host:"evil.example.test","x-forwarded-host":"evil.example.test"}}));
  expect(r.status).toBe(401);
  expect(r.headers.get("www-authenticate")).toContain(`resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
  expect((await r.json()).error).toEqual({code:"unauthorized",message:"A valid API key is required."});
});

it("returns HTTP 403 and the unchanged REST scope error",async()=>{
  const t=await accessToken("services:read");
  const r=await bookingStatus(new Request(`${origin}/api/v1/bookings/foreign`,{headers:headers(t)}),{params:Promise.resolve({id:"foreign"})});
  expect(r.status).toBe(403);
  expect(r.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
  expect((await r.json()).error).toEqual({code:"forbidden_scope",message:"This API key lacks the required scope."});
});
