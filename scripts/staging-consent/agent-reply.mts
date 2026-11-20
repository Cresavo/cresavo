// One line from the agent process to the runner. `raw` is the complete MCP SDK result,
// every content block, resource and field, so the runner's leak check scans what actually
// reached the agent, not only the projection the scenarios assert on.
export function agentReply(id: unknown, result: { content?: unknown; structuredContent?: unknown; isError?: unknown }) {
  const text = (result.content as { type: string; text?: string }[] | undefined)?.find(c => c.type === "text")?.text ?? "{}";
  return JSON.stringify({ id, isError: Boolean(result.isError), body: result.structuredContent ?? JSON.parse(text), text, raw: JSON.stringify(result) });
}
