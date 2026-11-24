import { authorizationServerMetadata, oauthEndpoint } from "@/lib/agent-api/grants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = oauthEndpoint((_request, origin) => authorizationServerMetadata(origin));
