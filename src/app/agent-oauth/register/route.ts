import { oauthEndpoint, register } from "@/lib/agent-api/grants/server";

export const POST = oauthEndpoint(register);
