// Talks to the concept's MCP endpoint like Claude would: lists today's
// bookings, finds a free time and proposes moving one booking. The proposal
// then waits in the studio Inbox (/studio/inbox) for the owner to approve.
//
//   npm run concept:mcp-demo                      # http://localhost:3000
//   npm run concept:mcp-demo -- http://localhost:3600
//
// Uses CONCEPT_MCP_TOKEN when set, otherwise the public development token.
import { randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DEV_TOKEN } from "../src/concept/server/token";

type Booking = { id: string; date: string; start: string; end: string; status: string; service: { id: string; name: string }; staff: { id: string; name: string }; customer: { name: string } };

const base = process.argv[2] ?? "http://localhost:3000";
const token = process.env.CONCEPT_MCP_TOKEN || DEV_TOKEN;

const client = new Client({ name: "flerdo-concept-mcp-demo", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("/api/concept/mcp", base), {
    requestInit: { headers: { authorization: `Bearer ${token}`, "user-agent": "claude-code-demo-script" } },
  }),
);

async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]?.text ?? "{}";
  if (result.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text) as T;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

try {
  const { tools } = await client.listTools();
  console.log(`Connected to ${base}: ${tools.length} tools (${tools.map((t) => t.name).join(", ")})\n`);

  const { from, bookings } = await call<{ from: string; bookings: Booking[] }>("list_bookings");
  console.log(`Today's bookings (${from}):`);
  for (const b of bookings) console.log(`  ${b.start}–${b.end}  ${b.service.name.padEnd(28)} ${b.staff.name.padEnd(6)} ${b.customer.name}  [${b.id}]`);

  const booking = bookings.find((b) => b.status === "booked") ?? bookings[0];
  if (!booking) throw new Error("No bookings today to move.");
  let target: { date: string; time: string } | undefined;
  for (let day = 1; day <= 14 && !target; day++) {
    const date = addDays(from, day);
    const free = await call<{ staff: { starts: string[] }[] }>("get_availability", { serviceId: booking.service.id, date, staffId: booking.staff.id });
    const time = free.staff[0]?.starts.find((start) => start >= "13:00") ?? free.staff[0]?.starts[0];
    if (time) target = { date, time };
  }
  if (!target) throw new Error("No free time in the next two weeks.");

  console.log(`\nProposing to move ${booking.customer.name}'s ${booking.start} to ${target.date} ${target.time}…`);
  const proposal = await call<{ proposalId: string; status: string; title: string; changes: { label: string; before?: string; after: string }[]; message: string }>("propose_move", {
    bookingId: booking.id,
    ...target,
    idempotencyKey: randomUUID(),
  });
  console.log(`  ${proposal.title}`);
  for (const row of proposal.changes) console.log(`  ${row.label}: ${row.before ? `${row.before} → ` : ""}${row.after}`);
  console.log(`  Status: ${proposal.status}. ${proposal.message}`);
  console.log(`\nOpen ${new URL("/studio/inbox", base)} and approve it.`);
} finally {
  await client.close();
}
