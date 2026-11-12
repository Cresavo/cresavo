import type { Client } from "@modelcontextprotocol/client";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { formatBookingTime, formatPrice } from "../lib/format";
import { ZONE } from "../lib/time";

// An explicit, synthetic operator walkthrough, not an autonomous booking agent.
export async function runWorkspaceDemo(client: Client) {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answers = terminal[Symbol.asyncIterator]();
  async function read<T>(
    name: string,
    input: Record<string, unknown>,
  ): Promise<T> {
    const result = await client.callTool({ name, arguments: input });
    if (result.isError || result.content[0]?.type !== "text")
      throw new Error("MCP_WORKSPACE_CLIENT_FAILED");
    return JSON.parse(result.content[0].text) as T;
  }
  async function write<T>(
    name: string,
    input: Record<string, unknown>,
    summary: string,
  ): Promise<T | null> {
    const clientRequestId = randomUUID();
    console.log(`\n${summary}`);
    console.log(`Åtgärdsnyckel: ${clientRequestId}`);
    process.stdout.write(`Bekräfta ${name} genom att skriva ja: `);
    const answer = await answers.next();
    if (answer.done || answer.value.trim().toLowerCase() !== "ja") {
      console.log(
        "Avbruten. Ingen ytterligare ändring görs. Tidigare bekräftade ändringar ligger kvar.",
      );
      return null;
    }
    const value = await read<T>(name, {
      ...input,
      clientRequestId,
      confirmed: true,
    });
    console.log(`\n${name} ${JSON.stringify(value)}`);
    return value;
  }
  type Identity = { id: string; version: number };
  try {
    const name = "Syntetisk agentbehandling",
      priceOre = 50000;
    const service = await write<Identity>(
      "save_service",
      { name, priceOre, duration: 30, buffer: 0 },
      `Skapa ${name}, 30 min, ${formatPrice(priceOre)}, ingen buffert.`,
    );
    if (!service) return;
    const weekly = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      periods: [{ start: "09:00", end: "17:00" }],
      breaks: [],
    }));
    const staff = await write<Identity>(
      "save_staff",
      {
        name: "Syntetisk agentutförare",
        serviceIds: [service.id],
        weekly,
        exceptions: [],
      },
      `Skapa syntetisk utförare för tjänst ${service.id}, måndag–fredag 09–17 (${ZONE}), inga pauser/undantag.`,
    );
    if (!staff) return;
    let day = DateTime.now().setZone(ZONE).plus({ days: 1 });
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const date = day.toISODate()!;
    const slots = await read<string[]>("get_availability", {
      serviceId: service.id,
      staffId: staff.id,
      date,
    });
    if (slots.length < 2) throw new Error("MCP_WORKSPACE_DEMO_NO_SLOTS");
    const booking = await write<{ id: string }>(
      "create_booking",
      {
        serviceId: service.id,
        staffId: staff.id,
        serviceVersion: service.version,
        start: slots[0],
        customerName: "Syntetisk agentkund",
        customerEmail: `mcp-workspace-demo-${randomUUID()}@example.test`,
      },
      `Boka syntetisk kund: ${name}, ${formatBookingTime(slots[0])} (${ZONE}), utförare ${staff.id}.`,
    );
    if (!booking) return;
    const details = await read<Identity>("get_booking", { id: booking.id });
    const moves = await read<string[]>("get_move_availability", {
      id: booking.id,
      staffId: staff.id,
      date,
    });
    const start = moves.find((value) => value !== slots[0]);
    if (!start) throw new Error("MCP_WORKSPACE_DEMO_NO_MOVE");
    const moved = await write<Identity>(
      "move_booking",
      {
        id: booking.id,
        expectedVersion: details.version,
        staffId: staff.id,
        start,
      },
      `Flytta bokning ${booking.id}, version ${details.version}, till ${formatBookingTime(start)} (${ZONE}).`,
    );
    if (!moved) return;
    const cancelled = await write<Identity>(
      "cancel_booking",
      { id: booking.id, expectedVersion: moved.version },
      `Avboka ${booking.id}, version ${moved.version}. Tiden frigörs och historiken bevaras.`,
    );
    if (!cancelled) return;
    const inactiveStaff = await write<Identity>(
      "save_staff",
      {
        id: staff.id,
        expectedVersion: staff.version,
        name: "Syntetisk agentutförare",
        active: false,
        serviceIds: [service.id],
        weekly,
      },
      `Inaktivera demoutförare ${staff.id}, version ${staff.version}; bevara schemat och historiken.`,
    );
    if (!inactiveStaff) return;
    const inactiveService = await write<Identity>(
      "save_service",
      {
        id: service.id,
        expectedVersion: service.version,
        name,
        priceOre,
        duration: 30,
        buffer: 0,
        active: false,
      },
      `Inaktivera demotjänst ${service.id}, version ${service.version}; bevara bokningshistoriken.`,
    );
    if (!inactiveService) return;
    console.log(
      "Arbetsytedemo klar. Syntetisk avbokning och inaktiva demoresurser är kvar för granskning i admin.",
    );
  } finally {
    terminal.close();
  }
}
