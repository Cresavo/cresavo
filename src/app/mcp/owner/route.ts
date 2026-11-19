import { endpoint } from "@/concept/pairing/http";
import { mcp } from "@/concept/pairing/mcp";

export const POST = endpoint(mcp, "handler");
export const GET = endpoint(mcp, "handler");
