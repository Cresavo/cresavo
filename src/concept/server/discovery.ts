import { USP_VERSION } from "@/lib/agent-api/discovery";
import { SALON_TIMEZONE } from "../tools/clock";
import { conceptTools } from "../tools/registry";
import { toolContext } from "./demo-business";
import { BRAND } from "../brand";

// Discovery documents for the demo business: an A2A agent card and a USP
// profile, following the engine's `src/lib/agent-api/discovery.ts`. Both say
// plainly what is not implemented. The origin comes from `discoveryOrigin()`,
// never from request headers.

export const CONCEPT_PATHS = {
  mcp: "/api/concept/mcp",
  a2a: "/api/concept/a2a",
  agentCard: "/api/concept/a2a/agent-card.json",
  usp: "/api/concept/usp",
} as const;

const LIMITS = "Synthetic demo business. Customer agents can read services and free times; the booking itself is finished by the person on the booking page. No holds, payment or messages.";

export function conceptAgentCard(origin: string) {
  const { state } = toolContext();
  return {
    name: `${state.salon.name} on ${BRAND.name} (demo)`,
    version: "0.1.0",
    description: `Find a service and a free time at ${state.salon.name}, ${state.salon.area}. ${LIMITS}`,
    supportedInterfaces: [{ url: `${origin}${CONCEPT_PATHS.a2a}`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    provider: { organization: `${BRAND.name} (demo)`, url: origin },
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "customer-booking",
        name: "Find a time",
        description: 'Send JSON text: {"action":"services"}, {"action":"availability","serviceId":"…","date":"YYYY-MM-DD"} or {"action":"book","serviceId":"…"} for a booking page link.',
        tags: ["booking", "demo"],
        examples: ['{"action":"services"}'],
      },
    ],
    "x-flerdo": { status: "demo", limitations: LIMITS },
  };
}

export function conceptUspProfile(origin: string) {
  const { state } = toolContext();
  const version = USP_VERSION;
  return {
    usp: {
      version,
      services: {
        "dev.usp-protocol.services": [{ version, transport: "mcp", endpoint: `${origin}${CONCEPT_PATHS.mcp}`, spec: "https://usp-protocol.dev/transport/mcp/" }],
      },
      capabilities: {
        "dev.usp-protocol.services.catalog": [{ version }],
        "dev.usp-protocol.services.availability": [{ version, holds: false }],
      },
      business: { name: `${state.salon.name} (synthetic demo)`, timezone: SALON_TIMEZONE, currency: "SEK" },
    },
    authorization: { privileged_operations_require_authentication: true, accepted_mechanisms: ["bearer_token"] },
    "x-flerdo": {
      status: "synthetic-discovery-preview",
      tools: conceptTools.map((tool) => tool.name),
      compatibility: `USP profile discovery only. Catalog and availability use ${BRAND.name}'s own MCP tools (list_services, get_availability); canonical USP wire format, holds and direct booking are not implemented.`,
      bookings: `Agents create proposals (propose_booking); the owner approves them in ${BRAND.name}.`,
      a2a_agent_card: `${origin}${CONCEPT_PATHS.agentCard}`,
    },
  };
}
