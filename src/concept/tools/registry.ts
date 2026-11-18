import type { ReadTool, WriteTool } from "./define";
import { readTools } from "./read";
import { writeTools } from "./write";

// Every action an outside AI can take on the demo business. Protocol adapters
// (`server/mcp.ts` today) register these and add nothing of their own beyond
// authentication, logging and the proposal inbox.

export type ConceptTool = ReadTool | WriteTool;

export const conceptTools: readonly ConceptTool[] = [...(readTools as ReadTool[]), ...(writeTools as WriteTool[])];

export function findTool(name: string): ConceptTool | undefined {
  return conceptTools.find((tool) => tool.name === name);
}
