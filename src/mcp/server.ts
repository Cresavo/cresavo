import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { listServices, getAvailability, listBookings, createCampaign } from "../lib/domain";
import { db } from "../lib/db";
const admin = process.argv.includes("--admin");
const reply = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
serveStdio(() => {
 const server = new McpServer({name:"booking-lab-se",version:"0.1.0"});
 server.registerTool("list_services", {description:"Lista demosalongens behandlingar",inputSchema:z.object({})}, async () => reply(await listServices()));
 server.registerTool("get_availability", {description:"Lediga tider för en behandling och ett lokalt datum YYYY-MM-DD",inputSchema:z.object({serviceId:z.string(),date:z.string()})}, async v => reply(await getAvailability(v.serviceId,v.date)));
 if (admin) {
  server.registerTool("list_bookings", {description:"Lista bokningar; endast lokal administratör",inputSchema:z.object({})}, async () => reply(await listBookings()));
  server.registerTool("create_campaign_draft", {description:"Skapa opublicerat erbjudande. Datum anges YYYY-MM-DD; publicering sker manuellt i administrationen.",inputSchema:z.object({serviceId:z.string(),title:z.string(),discountPercent:z.number().int(),validFrom:z.string(),validUntil:z.string()})}, async v => reply(await createCampaign(v)));
 }
 server.server.onclose = () => { void db.$disconnect(); };
 return server;
});
