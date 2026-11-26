import { issuePageToken } from "@/concept/receptionist/web-call/page-token";
import { webCallRuntime, webCallStatus } from "@/concept/receptionist/web-call/runtime";
import { RingPage } from "@/concept/studio/web-call/ring-page";

// Rendered on every request: each visit gets its own signed page token.
export const dynamic = "force-dynamic";

export default function Page() {
  const status = webCallStatus();
  const runtime = webCallRuntime();
  const token = typeof runtime === "string" ? null : issuePageToken(runtime.secret).token;
  return <RingPage token={token} status={status} />;
}
