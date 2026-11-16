import { z } from "zod";

export type ModelTier = "fast" | "smart" | "image" | "speech";
export function defineTask<I extends z.ZodType, O extends z.ZodType>(definition: {
  id: string; version: number; tier: ModelTier; prompt: string;
  input: I; output: O; fallback: (input: z.infer<I>) => z.infer<O>;
}) {
  return { ...definition, schema: z.toJSONSchema(definition.output) };
}
export function validateOutput(schema: z.ZodType, value: unknown) {
  return schema.safeParse(value);
}
export const textField = z.string().trim().min(1).max(10000);
