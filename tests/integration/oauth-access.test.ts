import { beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { accessToken, origin, rpcBody } from "../helpers/oauth";
import { resign } from "../helpers/oauth-sign";
import { db } from "../../src/lib/db";
import { authenticateAgent, createAgentApiKey } from "../../src/lib/agent-api/keys";
import { issueSyntheticMandate } from "../../src/lib/agent-api/mandates";
import { GET as services } from "../../src/app/api/v1/services/route";
import { POST as mcp } from "../../src/app/api/v1/mcp/route";
import { POST as book } from "../../src/app/api/v1/bookings/route";
import { GET as getBooking } from "../../src/app/api/v1/bookings/[id]/route";
import { POST as cancelBooking } from "../../src/app/api/v1/bookings/[id]/cancel/route";
const clients = new Set<string>();
beforeEach(() => {
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_OAUTH_LAB", "1");
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => {
  const ids = [...clients];
  const keys = await db.agentApiKey.findMany({where:{clientId:{in:ids}}});
  const links = await db.agentBooking.findMany({where:{clientId:{in:ids}}});
  await db.agentApiEvent.deleteMany({where:{keyId:{in:keys.map(k=>k.id)}}});
  await db.agentBooking.deleteMany({where:{clientId:{in:ids}}});
  await db.booking.deleteMany({where:{id:{in:links.map(l=>l.bookingId)}}});
  await db.agentMandate.deleteMany({where:{clientId:{in:ids}}});
  await db.agentApiKey.deleteMany({where:{clientId:{in:ids}}});
  await db.agentClient.deleteMany({where:{id:{in:ids}}});
  await db.$disconnect();
});
const req = (token?: string, path = "/api/v1/services?business=demo", init: RequestInit = {}) => new Request(`${origin}${path}`, {...init, headers:{...(token ? {authorization:`Bearer ${token}`} : {}), ...init.headers}});
async function principal(token: string) {
  const p = await authenticateAgent(new Headers({authorization:`Bearer ${token}`}),db,"services:read"); clients.add(p.clientId); return p;
}
const rpc = (token: string, name: string) => mcp(req(token,"/api/v1/mcp",{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:{business:"demo"}}})}));
it("accepts OAuth on REST and MCP, preserves stable identity and emits no secrets", async () => {
  const logs = vi.spyOn(console,"info").mockImplementation(()=>{});
  const t = await accessToken(), p = await principal(t);
  expect((await principal(t)).clientId).toBe(p.clientId);
  expect((await services(req(t))).status).toBe(200);
  const r = await rpc(t,"list_services"); expect(r.status).toBe(200);
  expect((await rpcBody(r)).result.structuredContent.services.length).toBeGreaterThan(0);
  const key = await createAgentApiKey({businessId:"demo",agentName:"OAuth isolation test",ownerName:"Synthetic",ownerContact:"oauth@example.test"},db); clients.add(key.record.clientId);
  vi.stubEnv("BOOKING_OAUTH_LAB",undefined);
  expect((await services(req(key.key))).status).toBe(200);
  expect((await services(req(undefined,undefined,{headers:{"x-api-key":key.key}}))).status).toBe(200);
  const output = JSON.stringify(logs.mock.calls);
  for(const secret of [t,key.key,"PRIVATE KEY","oauth@example.test"]) expect(output).not.toContain(secret);
});
it.each([{iss:"https://evil.example.test"},{aud:"wrong"},{exp:0},{exp:undefined},{exp:"wrong"}])("rejects invalid signed claims with metadata %j", async claims => {
  const t = resign(await accessToken(),claims);
  for(const response of [await services(req(t)),await rpc(t,"list_services")]) {
    expect(response.status).toBe(401); expect(response.headers.get("www-authenticate")).toContain(`${origin}/.well-known/oauth-protected-resource`);
    expect((await response.json()).error.code).toBe("unauthorized");
  }
});
it("rejects missing credentials and tampered signature",async()=>{
  const t = await accessToken();
  for(const token of [undefined,`${t.slice(0,-8)}AAAAAAAA`]) {
    const r = await services(req(token)); expect(r.status).toBe(401); expect(r.headers.get("www-authenticate")).toContain("resource_metadata=");
  }
});
it("returns scope challenges for REST and MCP tool calls",async()=>{
  const t = await accessToken("services:read"); await principal(t);
  for(const r of [await getBooking(req(t,"/api/v1/bookings/foreign"),{params:Promise.resolve({id:"foreign"})}),await rpc(t,"get_availability")]) {
    expect(r.status).toBe(403); expect(r.headers.get("www-authenticate")).toContain('error="insufficient_scope"'); expect((await r.json()).error.code).toBe("forbidden_scope");
  }
});
it("isolates two OAuth clients and an API-key client for read and cancellation",async()=>{
  const a = await accessToken(), b = await accessToken();
  const pa = await principal(a), pb = await principal(b); expect(pa.clientId).not.toBe(pb.clientId);
  const k = await createAgentApiKey({businessId:"demo",agentName:"OAuth ownership test",ownerName:"Synthetic",ownerContact:"oauth-owner@example.test"},db); clients.add(k.record.clientId);
  let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({days:17}); while(day.weekday>5) day=day.plus({days:1});
  const service = await db.service.findUniqueOrThrow({where:{id:"massage"}});
  for(const [index,token] of [a,k.key].entries()) {
    const p = await principal(token); const start = day.set({hour:11+index}).toISO()!;
    const mandate = await issueSyntheticMandate({businessId:"demo",clientId:p.clientId,serviceId:"massage",staffId:"staff-erik",validFrom:start,validUntil:DateTime.fromISO(start).plus({hours:1}).toISO(),expiresAt:DateTime.fromISO(start).minus({minutes:1}).toISO(),maxPriceOre:45000,currency:"SEK",origin:"synthetic-operator",originReference:"oauth-package2-test"},db);
    const response = await book(req(token,"/api/v1/bookings",{method:"POST",headers:{"content-type":"application/json","idempotency-key":`oauth-package2-${index}`},body:JSON.stringify({business:"demo",serviceId:"massage",serviceVersion:service.version,staffId:"staff-erik",start,customer:{name:"Synthetic OAuth",email:`oauth-package2-${index}@example.test`},confirmed:true,mandateId:mandate.id})}));
    expect(response.status).toBe(201); const {booking} = await response.json(); const context = {params:Promise.resolve({id:booking.id})};
    expect((await getBooking(req(token),context)).status).toBe(200);
    for(const foreign of index === 0 ? [b,k.key] : [a,b]) {
      for(const r of [await getBooking(req(foreign),context),await cancelBooking(req(foreign,`/api/v1/bookings/${booking.id}/cancel`,{method:"POST"}),context)]) {
        expect(r.status).toBe(404); expect((await r.json()).error.code).toBe("booking_not_found");
      }
    }
  }
});
