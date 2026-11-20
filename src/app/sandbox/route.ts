import { sandboxPage } from "@/lib/agent-api/sandbox/browser-page";

export function GET(request: Request) { return sandboxPage(request, false); }
