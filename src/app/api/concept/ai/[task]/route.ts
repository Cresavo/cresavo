import { isTaskName } from "@/concept/ai/registry";
import { InvalidTaskInput, runTask } from "@/concept/ai/run-task";
import { withRequestLog } from "@/concept/server/logger";
import { createRateLimiter } from "@/concept/server/rate-limit";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { checkBearer, tokenSource } from "@/concept/server/token";
import { UNVERIFIED_CLIENT, waitlistClientKey } from "@/concept/site/waitlist-server";
import { reportError } from "@/lib/error-report";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";

const takeLiveCall = createRateLimiter({ max: 8, windowMs: 60_000 });
// A daily ceiling per instance on top of the per-caller limit, so a leaked token cannot run up a bill.
const DAILY_LIVE_CALLS = 200;
const takeDailyCall = createRateLimiter({ max: DAILY_LIVE_CALLS, windowMs: 86_400_000 });

function allowProvider(request: Request): boolean {
  if (!fromSameOrigin(request) ||
      tokenSource() !== "env" || !checkBearer(request.headers).ok) return false;
  const caller = waitlistClientKey(request.headers);
  return caller !== UNVERIFIED_CLIENT && takeLiveCall(caller).ok && takeDailyCall("all").ok;
}

export const POST = withRequestLog("/api/concept/ai/[task]", async (request: Request, context: { params: Promise<{ task: string }> }, log) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  const { task } = await context.params;
  if (!isTaskName(task)) return Response.json({ error: "Unknown AI task" }, { status: 404 });
  log.task = task;
  try {
    const input = await request.json();
    const result = await runTask(task, input, { allowProvider: allowProvider(request) });
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof InvalidTaskInput) return Response.json({ error: "Invalid task input" }, { status: 400 });
    reportError(error, { code: "CONCEPT_AI_TASK_FAILED", route: "/api/concept/ai/[task]" });
    return Response.json({ error: "Unable to run task" }, { status: 500 });
  }
});
