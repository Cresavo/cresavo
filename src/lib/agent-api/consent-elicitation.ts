import { CLIENT_CAPABILITIES_META_KEY, inputRequired, type ClientCapabilities, type ServerContext } from "@modelcontextprotocol/server";

/**
 * URL elicitation on top of the email-code consent page (ADR 7). A client that declares URL
 * elicitation on the request is asked to open the salon's consent page for the person and then
 * retry; it then reads the outcome. Every other client gets the ordinary answer, which already
 * carries `consentUrl`. The page asks for the code sent to the customer's own address, and only
 * the server mandate that approval creates can authorise a booking: an elicitation answer is
 * never consent.
 */
export function consentElicitation(ctx: ServerContext, body: { proposal?: { status?: string }; consentUrl?: string } | undefined) {
  if (!body?.consentUrl || body.proposal?.status !== "pending") return null;
  if (ctx.mcpReq.inputResponses?.consent !== undefined) return null;
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
  const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined;
  if (!capabilities?.elicitation?.url) return null;
  return inputRequired({ inputRequests: { consent: inputRequired.elicitUrl({
    message: "Open the salon's page to review this booking. You confirm it with a code sent to your own e-mail address.",
    url: body.consentUrl,
  }) } });
}
