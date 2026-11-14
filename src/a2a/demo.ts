import { createServer } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { AgentCard, Message } from "@a2a-js/sdk";
import {
  AgentEvent,
  DefaultRequestHandler,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  ServerCallContext,
  type AgentExecutor,
} from "@a2a-js/sdk/server";
import { z } from "zod";
import { VersionNotSupportedError, toJsonRpcError } from "@a2a-js/sdk/errors";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";
import {
  bookingSchema,
  createBooking,
  getAvailability,
  listServices,
} from "../lib/domain";
import { listStaff } from "../lib/workspace-config";
import { safeFailure } from "../lib/errors";
import { dateSchema } from "../lib/validation";

const selection = z
  .object({
    serviceId: z.string().min(1).max(128),
    staffId: z.string().min(1).max(128),
    date: dateSchema,
  })
  .strict();
const command = z.discriminatedUnion("action", [
  selection.extend({ action: z.literal("availability") }).strict(),
  bookingSchema
    .pick({ serviceId: true, staffId: true, start: true, serviceVersion: true })
    .extend({
      action: z.literal("book"),
      serviceVersion: z.number().int().positive(),
      confirmed: z.literal(true),
      clientRequestId: z.uuid(),
    })
    .strict(),
]);

export function assertA2aDemo() {
  assertTestDatabase();
  if (
    process.env.BOOKING_A2A_DEMO !== "1" ||
    process.env.NODE_ENV === "production" ||
    ["VERCEL", "VERCEL_ENV", "VERCEL_URL"].some((key) => process.env[key]) ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
  )
    throw new Error("A2A_LOCAL_DEMO_REFUSED");
}

// Disposable local customer profile. It never receives owner permissions.
export async function startA2aDemo() {
  assertA2aDemo();
  const token = randomBytes(32).toString("hex");
  const executor: AgentExecutor = {
    async execute(context, events) {
      let result: unknown;
      try {
        const parts = context.userMessage.parts;
        if (parts.length !== 1 || parts[0].content?.$case !== "text")
          throw new SyntaxError("A2A_DEMO_INPUT_INVALID");
        const input = command.parse(JSON.parse(parts[0].content.value));
        if (input.action === "availability") {
          const [slots, services, staff] = await Promise.all([
            getAvailability(
              input.serviceId,
              input.date,
              undefined,
              input.staffId,
            ),
            listServices(),
            listStaff(),
          ]);
          const service = services.find((item) => item.id === input.serviceId);
          const person = staff.find((item) => item.id === input.staffId);
          if (!service || !person)
            throw new SyntaxError("A2A_DEMO_SELECTION_INVALID");
          result = {
            slots,
            service: {
              id: service.id,
              name: service.name,
              priceOre: service.priceOre,
              duration: service.duration,
              version: service.version,
            },
            staff: { id: person.id, name: person.name },
            timeZone: "Europe/Stockholm",
          };
        } else {
          const booking = await createBooking(
            {
              serviceId: input.serviceId,
              staffId: input.staffId,
              start: input.start,
              serviceVersion: input.serviceVersion,
              customerName: "A2A Demo",
              customerEmail: "a2a-demo@example.test",
            },
            `a2a_${input.clientRequestId}`,
            "a2a:local-customer-demo:v1",
          );
          result = {
            booking: {
              id: booking.id,
              serviceId: booking.serviceId,
              staffId: booking.staffId,
              startsAt: booking.startsAt.toISOString(),
              endsAt: booking.endsAt.toISOString(),
            },
          };
        }
      } catch (error) {
        result = { error: safeFailure(error) };
      }
      events.publish(
        AgentEvent.message(
          Message.fromJSON({
            messageId: randomUUID(),
            contextId: context.contextId,
            role: "ROLE_AGENT",
            parts: [{ text: JSON.stringify(result) }],
          }),
        ),
      );
    },
    async cancelTask() {
      throw new Error("A2A_DEMO_TASKS_UNSUPPORTED");
    },
  };
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const supplied = Buffer.from(request.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (request.headers.origin) {
      response.writeHead(403).end();
      return;
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      response.setHeader(
        "WWW-Authenticate",
        'Bearer realm="booking-lab-local-demo"',
      );
      response.writeHead(401).end();
      return;
    }
    response.setHeader("Content-Type", "application/json");
    if (
      request.method === "GET" &&
      request.url === "/.well-known/agent-card.json"
    ) {
      response.end(JSON.stringify(AgentCard.toJSON(card)));
      return;
    }
    if (request.method !== "POST" || request.url !== "/a2a") {
      response.writeHead(404).end();
      return;
    }
    let requestId: string | number | null = null;
    const rpcError = (
      error: { code: number; message: string; data?: unknown },
      status = 400,
    ) => {
      response
        .writeHead(status)
        .end(JSON.stringify({ jsonrpc: "2.0", id: requestId, error }));
    };
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let oversized = Number(request.headers["content-length"]) > 16384;
      // Drain excess bytes without storing or parsing them. Finishing the
      // request before closing avoids resets while the client is still sending.
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        bytes += chunk.length;
        oversized ||= bytes > 16384;
        if (!oversized) chunks.push(chunk);
      }
      if (oversized) {
        response.setHeader("Connection", "close");
        response.writeHead(413).end();
        return;
      }
      let rpc;
      try {
        rpc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        rpcError({ code: -32700, message: "Parse error" });
        return;
      }
      if (!rpc || typeof rpc !== "object" || Array.isArray(rpc)) {
        rpcError({ code: -32600, message: "Invalid Request" });
        return;
      }
      if (
        typeof rpc.id === "string" ||
        (typeof rpc.id === "number" && Number.isFinite(rpc.id))
      )
        requestId = rpc.id;
      const invalidId =
        "id" in rpc &&
        rpc.id !== null &&
        typeof rpc.id !== "string" &&
        !(typeof rpc.id === "number" && Number.isInteger(rpc.id));
      if (
        rpc.jsonrpc !== "2.0" ||
        typeof rpc.method !== "string" ||
        !rpc.method ||
        invalidId
      ) {
        rpcError({ code: -32600, message: "Invalid Request" });
        return;
      }
      if (request.headers["a2a-version"] !== "1.0") {
        rpcError(toJsonRpcError(new VersionNotSupportedError()));
        return;
      }
      if (rpc.method !== "SendMessage") {
        rpcError({ code: -32601, message: "Method not found" });
        return;
      }
      const result = await handler.handle(
        rpc,
        new ServerCallContext({ requestedVersion: "1.0" }),
      );
      response.end(JSON.stringify(result));
    } catch {
      rpcError({ code: -32603, message: "Internal error" }, 500);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("A2A_LOCAL_ADDRESS_INVALID");
  const url = `http://127.0.0.1:${address.port}`;
  const card = AgentCard.fromJSON({
    name: "Booking Lab — local synthetic customer demo",
    version: "0.1.0",
    description:
      "Find a time and create an explicitly confirmed synthetic booking. No owner access.",
    supportedInterfaces: [
      { url: `${url}/a2a`, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
    ],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    securitySchemes: {
      localBearer: { httpAuthSecurityScheme: { scheme: "bearer" } },
    },
    securityRequirements: [{ schemes: { localBearer: { list: [] } } }],
    skills: [
      {
        id: "synthetic-booking",
        name: "Synthetic booking",
        description: "Read availability or confirm a test booking",
        tags: ["demo"],
      },
    ],
  });
  const handler = new JsonRpcTransportHandler(
    new DefaultRequestHandler(card, new InMemoryTaskStore(), executor),
  );
  return {
    url,
    token,
    card,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
