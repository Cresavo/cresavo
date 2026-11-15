import { z } from "zod";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { safeFailure } from "../lib/errors";

// SDK validation otherwise formats issues before the handler's error boundary.
export function safeToolSchema<T extends z.ZodType>(
  schema: T,
): StandardSchemaWithJSON<z.input<T>, z.output<T>> {
  return {
    "~standard": {
      ...schema["~standard"],
      validate(value: unknown) {
        try {
          return { value: schema.parse(value) };
        } catch (error) {
          throw new Error(safeFailure(error).message);
        }
      },
    },
  };
}

export async function reply(operation: () => Promise<unknown>) {
  try {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(await operation()) },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: safeFailure(error).message }],
    };
  }
}
