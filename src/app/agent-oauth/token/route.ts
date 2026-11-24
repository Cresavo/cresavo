import { oauthEndpoint, token } from "@/lib/agent-api/grants/server";

export const POST = oauthEndpoint(token, "token");
