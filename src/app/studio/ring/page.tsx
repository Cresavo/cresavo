import { after } from "next/server";
import { issuePageToken } from "@/concept/receptionist/web-call/page-token";
import { cleanupRuntime, webCallRuntime, webCallStatus } from "@/concept/receptionist/web-call/runtime";
import { hangUpAll } from "@/concept/receptionist/web-call/server";
import { RingPage } from "@/concept/studio/web-call/ring-page";

// Rendered on every request: each visit gets its own signed page token.
export const dynamic = "force-dynamic";

export default function Page() {
  const status = webCallStatus();
  const runtime = webCallRuntime();
  // With the kill switch off, opening this page also hangs up any call still running from before.
  if (runtime === "off") {
    const cleanup = cleanupRuntime();
    if (cleanup) after(() => hangUpAll(cleanup).catch(() => undefined));
  }
  const token = typeof runtime === "string" ? null : issuePageToken(runtime.secret).token;
  return <RingPage token={token} status={status} />;
}
