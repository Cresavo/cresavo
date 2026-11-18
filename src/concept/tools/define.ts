import { z } from "zod";
import type { DemoAction } from "../actions";
import type { ChangeRow } from "../command/proposal";
import type { DemoState } from "../data/types";
import type { Clock } from "../finance/types";

// The shape every concept tool has, whichever protocol adapter (MCP today,
// A2A or others later) exposes it. Read tools return data; write tools only
// return a draft change that the owner has to approve.

export interface ToolContext {
  state: DemoState;
  clock: Clock;
}

/** Thrown by a tool when the request cannot be answered, e.g. an unknown id or a switched-off module. */
export class ToolError extends Error {
  constructor(
    readonly code: "not_found" | "module_off" | "invalid_range" | "not_possible",
    message: string,
    readonly alternatives?: string[],
  ) {
    super(message);
  }
}

/** A change the owner approves or declines. `action` is the same store action the command box dispatches. */
export interface ChangeDraft {
  title: string;
  subtitle?: string;
  rows: ChangeRow[];
  action: DemoAction;
  /** Shown to the owner after approving. */
  toast: string;
  destructive?: boolean;
}

interface ToolBase<Input extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: Input;
}

export interface ReadTool<Input extends z.ZodObject = z.ZodObject> extends ToolBase<Input> {
  kind: "read";
  run: (context: ToolContext, input: z.infer<Input>) => Record<string, unknown>;
}

export interface WriteTool<Input extends z.ZodObject = z.ZodObject> extends ToolBase<Input> {
  kind: "write";
  draft: (context: ToolContext, input: z.infer<Input>) => ChangeDraft;
}

export const readTool = <Input extends z.ZodObject>(tool: Omit<ReadTool<Input>, "kind">): ReadTool<Input> => ({ kind: "read", ...tool });
export const writeTool = <Input extends z.ZodObject>(tool: Omit<WriteTool<Input>, "kind">): WriteTool<Input> => ({ kind: "write", ...tool });

/** Field schemas shared by several tools. */
export const field = {
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, 24-hour clock"),
  staffId: z.enum(["anna", "erik"]),
};
