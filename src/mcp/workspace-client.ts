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
    console.log(`Request key: ${clientRequestId}`);
    process.stdout.write(`Type ja to confirm ${name}: `);
    const answer = await answers.next();
    if (answer.done || answer.value.trim().toLowerCase() !== "ja") {
      console.log(
        "Stopped. Earlier confirmed changes are still saved.",
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
      `Create ${name}, 30 min, ${formatPrice(priceOre)}, with no buffer.`,
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
      `Create a fictional team member for service ${service.id}, Monday to Friday 09:00–17:00 (${ZONE}), with no breaks or exceptions.`,
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
      `Book a fictional customer: ${name}, ${formatBookingTime(slots[0])} (${ZONE}), with staff member ${staff.id}.`,
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
      `Reschedule booking ${booking.id}, version ${details.version}, to ${formatBookingTime(start)} (${ZONE}).`,
    );
    if (!moved) return;
    const cancelled = await write<Identity>(
      "cancel_booking",
      { id: booking.id, expectedVersion: moved.version },
      `Cancel booking ${booking.id}, version ${moved.version}. This frees the time and keeps the booking history.`,
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
      `Deactivate demo team member ${staff.id}, version ${staff.version}. Keep their schedule and history.`,
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
      `Deactivate demo service ${service.id}, version ${service.version}. Keep the booking history.`,
    );
    if (!inactiveService) return;
    console.log(
      "Workspace demo complete. Review the fictional cancellation and inactive demo resources in the admin workspace.",
    );
  } finally {
    terminal.close();
  }
}
