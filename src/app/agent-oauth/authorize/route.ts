import { authorize, consent, oauthEndpoint } from "@/lib/agent-api/grants/server";

export const GET = oauthEndpoint(authorize);
export const POST = oauthEndpoint(consent);
