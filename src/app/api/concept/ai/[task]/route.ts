import { isTaskName } from "@/concept/ai/registry";
import { InvalidTaskInput, runTask } from "@/concept/ai/run-task";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ task: string }> }) {
  const { task } = await context.params;
  if (!isTaskName(task)) return Response.json({ error: "Unknown AI task" }, { status: 404 });
  try {
    const input = await request.json();
    const result = await runTask(task, input);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof InvalidTaskInput) return Response.json({ error: "Invalid task input" }, { status: 400 });
    return Response.json({ error: "Unable to run task" }, { status: 500 });
  }
}
