import { oauthEndpoint, revoke } from "@/lib/agent-api/grants/server";

export const POST = oauthEndpoint(revoke);
