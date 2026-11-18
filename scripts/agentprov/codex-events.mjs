// Never persist raw CLI output: MCP results may contain a bearer approval link.
export function mcpCall(event) {
  const item = event?.item;
  if (event?.type !== "item.completed" || item?.type !== "mcp_tool_call") return null;
  if (item.server !== "bookingproof") throw new Error("NATIVE_UNEXPECTED_SERVER");
  let result = item.result?.structuredContent;
  if (!result) {
    const text = item.result?.content?.find(c => c.type === "text")?.text;
    if (text) result = JSON.parse(text);
  }
  const errorText = JSON.stringify(item.error ?? result?.error ?? "");
  const errorFlags = ["approval", "denied", "401", "403", "404", "500", "503", "timeout", "deserialize", "connection", "transport", "sse", "invalid"]
    .filter(code => errorText.toLowerCase().includes(code));
  return { tool: item.tool, args: item.arguments, result, errorFlags, failed: Boolean(item.error || item.result?.isError) };
}

export function safeCall(call) {
  return { tool: call.tool, failed: call.failed,
    ...(call.errorFlags?.length ? { errorFlags: call.errorFlags } : {}),
    ...(typeof call.result?.error?.code === "string" && /^[a-z_]{1,64}$/.test(call.result.error.code) ? { errorCode: call.result.error.code } : {}),
    ...(call.result?.proposal?.id ? { proposalId: call.result.proposal.id } : {}),
    ...(["pending", "approved", "declined", "expired"].includes(call.result?.proposal?.status)
      ? { proposalStatus: call.result.proposal.status, hasMandate: Boolean(call.result.proposal.mandateId) } : {}),
    ...(call.result?.booking?.id ? { bookingId: call.result.booking.id } : {}) };
}

export function safeNote(text, credential) {
  return String(text).replaceAll(credential, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/blk_[a-f0-9]{12}_[A-Za-z0-9_-]{43}/g, "[key redacted]")
    .replace(/[A-Za-z0-9_-]{43,}/g, "[opaque redacted]").slice(0, 1500);
}
