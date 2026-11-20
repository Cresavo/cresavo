// One line from the agent process to the runner. `raw` is the complete MCP SDK result,
// every content block, resource and field, so the runner's leak check scans what actually
// reached the agent, not only the projection the scenarios assert on.
export function agentReply(id: unknown, result: { content?: unknown; structuredContent?: unknown; isError?: unknown }) {
  const text = (result.content as { type: string; text?: string }[] | undefined)?.find(c => c.type === "text")?.text ?? "{}";
  return JSON.stringify({ id, isError: Boolean(result.isError), body: result.structuredContent ?? JSON.parse(text), text, raw: JSON.stringify(result) });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentReply = { id?: unknown; isError?: boolean; body?: Record<string, any>; text?: string; tools?: string[]; failure?: string };

/**
 * The runner's side of the line protocol. A line that is not a JSON reply never throws out of
 * the stream callback (where it would escape the runner's cleanup); it fails every pending
 * request with a static code instead, and the line is kept only for the in-memory leak scan.
 */
export function agentChannel(write: (line: string) => void, transcript: string[], timeoutMs = 40_000) {
  const pending = new Map<number, { resolve: (r: AgentReply) => void; reject: (e: Error) => void }>();
  let sequence = 0;
  const failAll = (code: string) => { for (const [id, p] of pending) { pending.delete(id); p.reject(new Error(code)); } };
  function receive(line: string) {
    transcript.push(line);
    let reply: AgentReply;
    try { reply = JSON.parse(line); } catch { return failAll("AGENT_PROTOCOL_INVALID"); }
    if (!reply || typeof reply !== "object" || typeof reply.id !== "number" || !pending.has(reply.id)) return failAll("AGENT_PROTOCOL_INVALID");
    const waiter = pending.get(reply.id)!;
    pending.delete(reply.id);
    if (reply.failure) waiter.reject(new Error("AGENT_REQUEST_FAILED")); else waiter.resolve(reply);
  }
  const send = (message: object) => new Promise<AgentReply>((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("AGENT_TIMEOUT")); }, timeoutMs);
    pending.set(id, { resolve: r => { clearTimeout(timer); resolve(r); }, reject: e => { clearTimeout(timer); reject(e); } });
    write(JSON.stringify({ id, ...message }) + "\n");
  });
  return { receive, send, failAll };
}
