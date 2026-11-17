import { isTaskName } from "@/concept/ai/registry";
import { InvalidTaskInput, runTask } from "@/concept/ai/run-task";
import { withRequestLog } from "@/concept/server/logger";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";

export const POST = withRequestLog("/api/concept/ai/[task]", async (request: Request, context: { params: Promise<{ task: string }> }, log) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  const { task } = await context.params;
  if (!isTaskName(task)) return Response.json({ error: "Unknown AI task" }, { status: 404 });
  log.task = task;
  try {
    const input = await request.json();
    const result = await runTask(task, input);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof InvalidTaskInput) return Response.json({ error: "Invalid task input" }, { status: 400 });
    return Response.json({ error: "Unable to run task" }, { status: 500 });
  }
});
