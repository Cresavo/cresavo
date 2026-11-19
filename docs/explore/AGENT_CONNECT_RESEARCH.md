# Connect your own AI assistant to Cresavo

**Research snapshot · 18 November 2026.** This review uses public vendor and protocol documentation.
“(verify)” flags an undocumented, ambiguous or account-dependent capability to check in a live client. The
Cresavo connection flows below are proposals. No vendor account or hosted pairing was tested.

## Decision

Start with a fictional booking-reschedule demo in **Claude chat**, then test the same endpoint in an
eligible **ChatGPT Business or Enterprise/Edu workspace**. Include Grok in the first compatibility pass.
Its consumer app now documents custom MCP, and the separate Grok Bot product documents an in-app voice call.
Test the intersection of voice and custom tools before promising it. Gemini has a documented custom-app flow
with US-only eligibility, which makes it a later target for a Swedish demo.
[Claude custom connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities) ·
[ChatGPT custom connections](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) ·
[Grok connectors](https://docs.x.ai/grok/connectors) ·
[Grok Bot voice](https://docs.x.ai/grok-bot/chat-and-collaboration) ·
[Gemini custom apps](https://support.google.com/gemini/answer/17209137)

Use a hosted owner MCP endpoint and give each connection an explicit grant to read selected data and draft
changes. The studio Inbox applies an approved proposal through Cresavo's normal booking and business rules.
Keep the approval in Cresavo for the first demo. The owner can still act directly through the studio,
whether the assistant is connected or not. Later, extend coverage to the owner's permitted workflows and use
optional, bounded rules for repeatable actions.

## Where Cresavo starts

| Surface | Today | Design consequence |
| --- | --- | --- |
| Concept HTTP MCP | The local `/api/concept/mcp` uses Streamable HTTP with JSON responses, a shared demo bearer and one server-process copy of Salong Eko. The existing registry has reads and six draft tools. The local Inbox can decide proposals. The public read-only flag blocks this endpoint. | Reuse tool schemas and draft logic. Give hosted pairing its own isolated route, workspace and credentials. [Concept MCP](../../src/concept/server/mcp.ts) · [Demo state](../../src/concept/server/demo-business.ts) · [Registry](../../src/concept/tools/registry.ts) |
| Public studio | Fixture state lives in the browser, with same-origin tab updates via localStorage. The server's demo copy is separate. | Pairing needs a server source of truth for the paired slice and a browser sync path. [Browser store](../../src/concept/store.ts) · [Connection walkthrough](../CONNECT_AI_ASSISTANT.md) |
| Booking-engine owner MCP | Stdio. Admin mode trusts the launching operator. Write flags let the caller submit `confirmed: true`, and admin mode can save a campaign draft. Both are local patterns. The separate workday-card mode uses a guarded local test database, human-readable text and a read-only `ui://` view. | Reuse domain operations and the workday card's interaction pattern. Require an authenticated owner or an owner-authored policy for hosted decisions. [Owner server](../../src/mcp/server.ts) · [Workspace tools](../../src/mcp/workspace.ts) · [Card](../../src/mcp/owner-card/) |
| Customer-agent gateway | The separate gateway owns public customer-agent REST/MCP. The engine owns data, scopes, booking rules, mandates and conflicts. The local split proof exercises the customer journey and a Codex CLI, with different authority from a salon owner. | Keep owner delegation on the hosted owner app. Retain the separate customer gateway and its mandate boundary. [Gateway contract](../GATEWAY_SPLIT.md) |

## 1. Consumer assistants and remote MCP

Streamable HTTP is the single-endpoint transport, with either JSON or request-scoped SSE replies. “Legacy
SSE” below means the older HTTP+SSE transport. A host's action prompt, an MCP Apps card and protocol
elicitation are three different capabilities. OAuth authenticates the connection and grants scopes. Approval
authorizes an individual action.
[MCP transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) ·
[MCP Apps](https://apps.extensions.modelcontextprotocol.io/)

| App and eligibility | Transport and authentication | Mobile and voice | Interactive UI and elicitation |
| --- | --- | --- | --- |
| **Claude** web and Desktop. Free (one custom connector), Pro, Max, Ultra, Team and Enterprise. Team/Enterprise use organization provisioning and individual connection, with delegated Enterprise roles where configured. | Streamable HTTP and legacy SSE. OAuth with Claude's published client identity (CIMD), DCR or a registered client. Fixed request headers can carry a bearer or API key. | Web/Desktop setup carries to iOS/Android. Mobile connector installation is in beta, with web/Desktop the primary custom setup. Voice beta is documented on web, Desktop and iOS/Android and can use connected tools. Cresavo custom tool calls and approvals during voice (verify). | MCP Apps are documented as interactive connectors. Anthropic describes broad form elicitation and URL mode in Claude Code. Confirm form/URL support in Claude web, Desktop, mobile and voice for this server (verify). [Connector help](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities) · [Transport](https://claude.com/docs/connectors/building) · [OAuth and fixed headers](https://claude.com/docs/connectors/building/authentication) · [Voice](https://support.claude.com/en/articles/11101966-use-voice-mode) · [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) · [Elicitation](https://claude.com/resources/articles/building-agents-that-reach-production-systems-with-mcp) |
| **ChatGPT** web. Full custom MCP including writes for Business and Enterprise/Edu. Business admins/owners create and publish. Enterprise/Edu can delegate creation via RBAC, with admins/owners publishing. Pro custom connections are read/fetch only. Directory availability has its own controls. | Streamable HTTP or legacy SSE via public HTTPS or Secure MCP Tunnel. OAuth supports CIMD, DCR and pre-registered clients. No auth and mixed OAuth/no auth are also documented. A custom static bearer header is unavailable for this web integration. | Custom connection setup is web-only. Current Live voice docs allow eligible plugins and connected apps on web and iOS/Android and require on-screen action approval. Use of a particular privately added remote MCP plugin on mobile and in Live (verify). | MCP Apps on supported plugin surfaces. OpenAI documents elicitation for gathering structured input. Form/URL coverage by client, in-flight resume and use as an approval channel (verify). Host write confirmation is separately configurable. [Custom connections and plans](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) · [Add a server](https://developers.openai.com/api/docs/guides/custom-mcp-server) · [OAuth](https://developers.openai.com/plugins/build/auth) · [Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) · [Elicitation](https://developers.openai.com/plugins/build/mcp-server) · [UI](https://developers.openai.com/plugins/build/app-quickstart) |
| **Grok** consumer. Connectors are documented for all users. Business/Enterprise admin provisions before members connect. Separate **Grok Bot** has paid eligibility and team policies. | Consumer custom MCP uses a public URL. Tunneling docs cover Streamable HTTP and legacy SSE and mention OAuth and API-key setup. Consumer CIMD, DCR and exact bearer/header options (verify). Bot desktop supports remote HTTPS with optional headers and OAuth client ID/secret. Bot transport variants and CIMD/DCR (verify). | Consumer web setup is documented. Consumer mobile custom tool use and the intersection with Grok voice (verify). Separate Grok Bot documents live calls on desktop and iOS/Android. Custom remote tool invocation in a Bot voice call (verify). | Standards-based MCP Apps and form/URL elicitation on consumer Grok and Bot (verify). Bot's own approval UI is separate. Bot connections are account-wide, so check whether a grant can be attributed to an individual Bot (verify). [Grok connectors](https://docs.x.ai/grok/connectors) · [Tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling) · [Grok overview](https://docs.x.ai/grok/overview) · [Bot custom setup](https://docs.x.ai/grok-bot/computer-and-apps) · [Bot mobile and eligibility](https://docs.x.ai/grok-bot/mobile) · [Bot voice](https://docs.x.ai/grok-bot/chat-and-collaboration) |
| **Gemini Apps** personal accounts, US, age 18+, English, History on. Google lists these eligibility requirements and gives no paid tier requirement. Work and school accounts are excluded from this custom URL flow. | Connected Apps Platform documents Streamable HTTP (up to MCP `2025-11-25`) and excludes legacy SSE. Custom app help documents OAuth DCR and an advanced credentials option for servers without it. CIMD and static bearer for this consumer flow (verify). | Add on the web, use on the web and mobile. Some Connected Apps work in Gemini Live. Custom MCP in Live (verify). | Google documents MCP UI resources and host user-confirmation settings for Connected Apps Platform. Rendering the same UI for an unlisted custom URL, especially on mobile, and protocol form/URL elicitation (verify). [Custom app help](https://support.google.com/gemini/answer/17209137) · [Connected Apps and Live](https://support.google.com/gemini/answer/13695044) · [Integration standards](https://developers.google.com/connected-apps/mcp/server-optimization) · [UI and confirmation](https://developers.google.com/connected-apps/gpc/perform-the-steps) |
| **Mistral Vibe for Work (formerly Le Chat).** The Le Chat launch said connectors were available to all users. Current Vibe docs require an administrator to add a directory/custom MCP connector for an organization. Current personal Free/paid provisioning and limits (verify). | Streamable HTTP is the recommended transport. Mistral's Vibe example uses legacy SSE. Work docs list OAuth 2.1 with DCR, HTTP bearer and Basic. CIMD (verify). | Vibe Work is on web and mobile. Custom connector use and setup on mobile (verify). Voxtral dictation is documented on web and iOS/Android on all plans. It transcribes into a normal task, where the user can attach a connector. Live, bidirectional voice with custom MCP (verify). | Work's guide excludes MCP resources for custom connectors, so plan for text with third-party MCP. Generic third-party MCP Apps rollout and protocol elicitation (verify). Per-tool Continue / Always allow / Decline is documented as host approval. [Current MCP guide](https://docs.mistral.ai/vibe/work/web/connectors/mcp-connectors) · [SSE example](https://docs.mistral.ai/resources/cookbooks/mistral-lechat_custom_mcp_server-custom-mcp-server) · [Launch](https://mistral.ai/news/le-chat-mcp-connectors-memories/) · [Vibe rebrand](https://help.mistral.ai/en/articles/682992-le-chat-is-now-vibe) · [Voice mode](https://docs.mistral.ai/vibe/work/voice-mode) |
| **Microsoft Copilot.** Personal Copilot documents catalog connections such as Gmail and OneDrive. An arbitrary remote URL in personal Copilot (verify). The documented build path is a Power Platform/Copilot Studio maker adding MCP to an agent, then publishing it to organizational users. Licensing and tenant policies apply. | Copilot Studio supports Streamable HTTP and dropped legacy SSE. The maker flow supports OAuth 2.0 with discovery/DCR, manually supplied endpoints/client configuration, API key or no auth. CIMD and exact custom bearer-header compatibility (verify). | Published agents can surface in Teams and Microsoft 365 Copilot. Custom MCP and UI on mobile (verify). Copilot Voice and Copilot Studio voice channels exist. Custom MCP and confirmation in a particular voice channel (verify). | Microsoft documents MCP Apps in Microsoft 365 Copilot and Copilot Studio preview chat, with Teams and embedded web chat excluded. Protocol elicitation (verify). [Personal connectors](https://support.microsoft.com/en-us/microsoft-copilot/connecting-microsoft-copilot-to-other-services) · [Studio transport and auth](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent) · [Studio licensing](https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing) · [Microsoft 365 Voice](https://support.microsoft.com/en-us/microsoft-365-copilot/frequently-asked-questions-about-voice-features-in-microsoft-365-copilot) · [Studio voice agents](https://learn.microsoft.com/en-us/microsoft-copilot-studio/voice-realtime-configure) · [MCP Apps](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/mcp-apps) |

### Setup an owner can follow

1. **Claude.** On Claude web or Desktop, open **Customize → Connectors → Add → Custom → Web**. Some layouts
   say **+ Add → Add custom connector**. Enter a name and the full MCP URL, continue through detected
   authentication, use **Sign in now** and the published identity or automatic registration as directed by
   Cresavo, then add and consent. Enable it under the chat composer's **+ → Connectors**. On
   Team/Enterprise, an authorized admin first adds it under **Organization settings → Connectors**, then
   the member uses **Customize → Connectors** to connect. For a listed connector, browse the directory's
   **Connectors** tab, choose the listing, connect and authorize. Directory submission is a later
   distribution step.
   [Custom walkthrough](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) ·
   [Directory help](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory) ·
   [Marketplace and submission](https://claude.com/marketplace/connectors-plugins)
2. **ChatGPT.** On the web in an eligible account, open **Plugins → + → Add custom MCP server**. Enter name
   and server URL, choose OAuth and the registration method, acknowledge the risk prompt and choose
   **Create as a plugin**. Review discovered tools, install the plugin and complete sign-in when prompted.
   Use it via **@** or the chat tool picker. For a legacy workspace, use **Settings → Apps → Create**
   (workspace or user settings depending on role), configure the URL/auth, choose **Scan Tools**, authorize
   and test the draft. Legacy accounts may require **Settings → Apps → Advanced settings → Developer mode**. In the current Plugins flow the warning is per server. Later a listed plugin can be found and installed
   from the directory, then its Cresavo account connected.
   [Current and legacy flows](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) ·
   [Plugins directory](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt) ·
   [Submission](https://developers.openai.com/plugins/deploy/submission)
3. **Grok.** Open [Grok Connectors](https://grok.com/connectors), choose **New Connector → Custom**, paste
   the MCP URL and follow the authentication prompt. Business/Enterprise admins use
   **console.x.ai → team → Grok Business → Connectors → Add Connector**, then members connect in Grok. For
   the separate Bot product, use desktop **Connect apps → Add a custom connector → Remote HTTPS**, fill
   name and URL, configure headers or registered OAuth settings if needed, choose **Add plugin** and
   authorize. Test with **@** in the Bot chat before testing voice.
   [Consumer setup](https://docs.x.ai/grok/connectors) ·
   [Business setup](https://docs.x.ai/grok/connector-management) ·
   [Bot setup](https://docs.x.ai/grok-bot/computer-and-apps)
4. **Gemini.** On Gemini web, open **Settings → Connected Apps** (some layouts put it under
   **Personal Intelligence** ). Under **Custom apps**, paste a URL in the initial field or choose
   **Add a custom app**. Use **Advanced features → Show more** for issued credentials when DCR is
   unavailable. Choose **Next**, then follow the linking prompts. Ask in chat by app name or select it with
   **@** where offered. [Consumer setup](https://support.google.com/gemini/answer/17209137) ·
   [App invocation](https://support.google.com/gemini/answer/13695044)
5. **Vibe.** In Work, open **Connectors → + Add Connector → Custom MCP Connector** as the administrator.
   Enter a unique name and full server URL, then **Connect** and follow the detected sign-in prompts. Open
   **My Connectors** to see the connected tool and its permissions. From a task, use **+ → Tools** to enable
   it explicitly. [Custom MCP setup](https://docs.mistral.ai/vibe/work/web/connectors/mcp-connectors) ·
   [Use in a task](https://docs.mistral.ai/vibe/work/connectors)
6. **Copilot.** The owner uses a published agent supplied by their organization. A maker opens
   **Copilot Studio → agent → Tools → Add a tool**, chooses **Model Context Protocol → New tool**, enters
   the name, description and HTTPS URL, chooses auth and creates the connection. In the new preview
   experience use **Build → Tools → Add tool → Model Context Protocol (MCP)**. Test, publish, share with
   the owner, and enable **Teams and Microsoft 365 Copilot** under **Channels**. The owner opens the shared
   agent and signs in to the connection when prompted. Prefer end-user credentials and verify the channel
   supports them.
   [Maker setup](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent) ·
   [Preview setup](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/tools-add-mcp-server) ·
   [Publishing walkthrough](https://learn.microsoft.com/en-us/power-pages/configure/mcp-connect-clients)

## 2. Voice

| Route | What it would look like | Tradeoff |
| --- | --- | --- |
| **Use the assistant's app** | Pair in text first. When a booking request appears in the demo, open Claude voice or an eligible ChatGPT Live chat, ask for the latest request, then ask to draft a move. Try the same with Grok Bot's in-app voice chat after desktop setup, and with consumer Grok voice if custom tool calls work (verify). The Inbox shows the proposed change for a tap. | The owner keeps their assistant and subscription. The host controls access, voice UI and tool routing. ChatGPT Live documents on-screen approval only. Dictation into an ordinary connected chat gives a spoken-input fallback on a phone. [Claude Voice](https://support.claude.com/en/articles/11101966-use-voice-mode) · [ChatGPT Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) · [Grok Bot voice](https://docs.x.ai/grok-bot/chat-and-collaboration) |
| **Dial a vendor number** | 1-800-ChatGPT is an experimental service for US/Canadian numbers from supported countries, with no account required. A way to reach a personal Cresavo-enabled connector on that line, or to dial the owner's consumer Grok Bot over the phone network, is unverified (verify). xAI's Voice Agent Builder offers a number for a separately configured agent, with remote MCP tools and a bring-your-own SIP option. | A dialable number is easy to reach. An accountless phone service gives Cresavo no documented owner/session binding. A builder agent has its own credentials, configuration and billing. xAI documents call recording and transcripts. Check retention controls and number availability before choosing it. [1-800-ChatGPT](https://help.openai.com/en/articles/10193193-1-800-chatgpt-calling-and-messaging-chatgpt-with-your-phone) · [xAI Voice Agent Builder](https://x.ai/news/grok-voice-agent-builder) · [xAI SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip) |
| **Cresavo push-to-talk or phone agent with OpenAI Realtime** | An authenticated studio user starts WebRTC audio, or a SIP carrier routes a dial-in to an API session after a verified webhook. Configure named remote MCP tools with scoped auth or use server-run function tools that call Cresavo MCP. Realtime supplies an `mcp_approval_request` event for configured approval. Have the app resolve it after an owner interaction when needed. | Cresavo controls identity, the confirmation screen and tool availability. It also owns the integration, audio costs, call handling, privacy decisions and uptime. The same proposal policy applies to both chat and phone. [Realtime tools and approval](https://developers.openai.com/api/docs/guides/realtime-mcp) · [SIP](https://developers.openai.com/api/docs/guides/voice-sip) · [Server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls) |
| **Cresavo voice via xAI Speech to Speech** | Use WebSocket for app audio or Direct SIP with carrier, registered phone number and verified webhook. Provide `server_url`, an allowlist of tools and a scoped `authorization` token or headers. The same xAI remote MCP tool is documented in the native SDK and Responses-compatible API. | Both Streamable HTTP and legacy SSE are supported by the API. xAI says Responses' `require_approval` and `connector_id` parameters are unsupported. Treat this as developer-hosted voice, with Cresavo enforcing approvals and tracking usage. API-level MCP Apps or protocol elicitation (verify). [Remote MCP API](https://docs.x.ai/developers/tools/remote-mcp) · [Speech to Speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech) · [SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip) |

Lead with “talk to the assistant you already use” and a text or dictation fallback. If a real dial-in is
important, pilot it only after the paired studio flow. Caller ID is a routing signal. Authenticate the owner
in the app and bind the approved action to the active call, business and exact proposal. Read back the date,
time, customer and intended effects. A dropped call leaves the draft pending. Surface new bookings through
the studio's normal Inbox and notifications. The owner starts the conversation from their assistant or the
studio. Use the studio to approve high-impact changes, with no real calls or messages in the public demo.
Test Swedish speech, relative dates, names and Stockholm time across a daylight-saving boundary.

## 3. MCP specification

The current revision is **`2026-07-28`**. The MCP project targets March 2027 for the next regular release.
Support the July revision alongside the handshake-era revisions that clients actually use. In the July
revision, each request carries its version and applicable client context and capabilities. Discovery via
`server/discover` is optional, and Streamable HTTP no longer uses a protocol session ID or a standalone GET
SSE stream in that revision. Keep the legacy `initialize` flow for older peers. Keep app state and approval
records in Cresavo. [Versioning](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) ·
[July release](https://blog.modelcontextprotocol.io/posts/2026-07-28/) ·
[Release schedule](https://blog.modelcontextprotocol.io/posts/mcp-release-cycle/)

| Feature | Spec and design implications |
| --- | --- |
| **OAuth 2.1 over HTTPS** | The resource server publishes RFC 9728 Protected Resource Metadata and identifies its authorization server. An unauthenticated request gets a Bearer challenge with a `resource_metadata` pointer. The client discovers authorization/token endpoints via RFC 8414 or OpenID discovery, sends an RFC 8707 `resource` at authorization and token exchange, and uses authorization code with S256 PKCE for user grants. Bind the token audience to the exact MCP resource. Validate issuer, audience, expiry, active grant, business and scope on every request. Use `401` for invalid/expired tokens and `403` for insufficient scope, with the applicable Bearer challenge. Validate the authorization-response issuer when advertised (RFC 9207), and keep client credentials tied to the issuing server. [Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) · [Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery) |
| **CIMD, DCR and registered clients** | CIMD makes an HTTPS metadata document URL the client ID. The authorization server validates the document and redirect URIs, and advertises support in its own metadata. DCR registers the client at the authorization server and returns an issued ID. The July revision deprecates DCR and retains it for compatibility. Pre-registered client IDs are useful for known clients. Set exact redirect rules, secure metadata fetching and per-client consent. CIMD metadata describes the client. User approval and any stronger proof of client identity still come from their own flows. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) · [July release](https://blog.modelcontextprotocol.io/posts/2026-07-28/) · [ChatGPT registration](https://developers.openai.com/plugins/build/auth) |
| **Elicitation** | A capable host can render a form for missing inputs, disambiguation or an exact confirmation. Form mode supports a constrained schema and accept, decline or cancel responses. Keep credentials out of these forms. URL mode directs the user to an external page for a secure interaction. Legacy elicitation uses `elicitation/create` in an active request. The July revision embeds the request in an `input_required` result, and the client repeats the original call with `inputResponses` and the echoed, opaque `requestState` where supplied. Advertise and check mode support, bind state to owner/grant/proposal and support an Inbox fallback if the host lacks the required capability. [Current elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) · [Legacy elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation) · [July release](https://blog.modelcontextprotocol.io/posts/2026-07-28/) |
| **MCP Apps** | The optional extension associates a tool with its `_meta.ui.resourceUri`. The host can read a `ui://` resource with MIME type `text/html;profile=mcp-app` and render it in a sandboxed iframe with declared CSP and a host-mediated bridge. Support text and structured output independently of rendering. A card can show a workday or proposal diff and open a studio link. Apply the same app authentication and validation to any action the card triggers. [MCP Apps](https://apps.extensions.modelcontextprotocol.io/api/) · [Cresavo card registration](../../src/mcp/owner-card/register.ts) |
| **Tool output** | Declare an `outputSchema` and validate `structuredContent` against it. Use an object envelope for compatibility with older hosts, with a compact text summary or serialized JSON for text-only clients. Keep summaries concise and structured fields stable. Use tool results with `isError: true` for expected failures the model can recover from. Reserve protocol errors for invalid requests and protocol failures. [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) |
| **Annotations** | Set `readOnlyHint: true` for queries. Creating an Inbox record is a write, so a draft tool uses `readOnlyHint: false` and ordinarily `destructiveHint: false` when its only effect is adding the draft. Use `destructiveHint` for tools whose actual effects can be destructive, `idempotentHint` where replay is safe and `openWorldHint` where calls interact with external entities, including external reads. Tell the owner the proposed final effect explicitly. Hints inform client behavior. Authorization, confirmation and quotas run on the server. Keep tools that can auto-apply distinct in their contract and annotations from draft-only tools. [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) · [OpenAI tool guidelines](https://developers.openai.com/plugins/plugin-guidelines) |
| **Server instructions** | Give a short, trusted description of the business scope, date and timezone defaults, how to find objects, how to draft, and when an operation is applied. Send instructions in legacy initialization and modern discovery when used. Include critical usage constraints in each tool description because invocation may happen without discovery. Keep authorization in the app. [Versioning and discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) · [SDK lifecycle](https://go.sdk.modelcontextprotocol.io/protocol/) · [Google instructions guidance](https://developers.google.com/connected-apps/mcp/server-optimization) |

## 4. Agent tool design and approval

### Tool contracts

- Expose owner intents such as `find_reschedule_options` and `propose_reschedule_booking`. Use CRUD
  internally where useful. Resolve a user's phrase to an inspected booking and a slot that fits its recorded
  duration, staff and buffers. Ask about ambiguous people or times before drafting. Keep effects and
  exclusions obvious in tool names, descriptions and schemas.
- Start with about **six to eight tools** for the demo and use business modules and scopes to determine
  available tools as the catalogue grows. There's no cross-client ideal count. Measure tool selection,
  missing-information prompts, retries, context volume and approval accuracy on realistic tasks. Keep names
  stable, avoid near-duplicates and preserve supported tool contracts when renaming.
  [Anthropic tool design](https://www.anthropic.com/research/writing-tools-for-agents) ·
  [OpenAI tool design](https://developers.openai.com/plugins/plan/tools)
- Use object IDs with human-readable labels, time zones, ISO dates/times, minor currency units and explicit
  currency. Accept bounded ranges and filters. Return a deterministic order, opaque `nextCursor` bound to
  business, grant and filters, and a capped `limit` (start at 20 for entity lists). Keep domain result
  paging separate from MCP's `tools/list` paging.
- Return stable codes, a plain-language message and the next safe step. For example, `multiple_matches`
  returns up to a few distinguishing candidates, `slot_unavailable` returns eligible alternatives, and
  `stale_version` asks the client to refresh and draft again. `approval_required` is an expected pending
  state, with proposal ID and review URL. Give retry advice for temporary failures and throttling.
- Give each intended draft a stable idempotency key, scoped to business, connection and operation. An
  identical normalized request returns the same proposal. Reusing a key for different input yields a
  conflict. Use transactional uniqueness, versions on affected resources, an independent idempotent apply
  operation and a durable outbox for any later external effect. Recheck rules at apply time. Returning an
  available slot or saving a draft does not reserve it.

### The owner's decision

| Pattern | Cresavo behavior |
| --- | --- |
| **Inbox approval** | Store a typed proposal, proposer identity, target and versions, expiry, and a server-generated preview of exact effects, including any notification and price changes. Return status and a normal review link. Only the signed-in owner or a separately authorized decision-maker can approve or decline. Apply the approved payload once through the same domain validation as manual actions. If a dependent record or slot changed, show a conflict and require a fresh proposal. |
| **Elicitation** | Form mode can capture details or display a confirmation in a capable host. For a third-party host, start with URL mode opening the authenticated Cresavo approval screen. Form-only commit needs a trusted way to attribute an explicit owner interaction to the exact proposal, owner, grant, version and expiry. An ordinary model argument or a prompt the host can auto-answer gives insufficient authority. On decline, cancellation, timeout or unsupported capability, keep the Inbox as the decision surface and never apply automatically. |
| **Owner rules** | An owner sets rules in the studio and can pause or revoke them. Start with a low-impact rule, such as dismissing a capacity suggestion for one location with a daily cap. Scope by connection, tool, target, schedule, expiry, impact and counts. Evaluate and debit limits atomically. Record rule ID/version and reason. Use manual review when the rule falls outside its bounds, and always require it for outbound messages, cancellation with fees, refunds, bulk changes, journal access changes and permission changes in early releases. |

### Data and security boundaries

- Treat customer messages, reviews, notes, names, attachments and imported text as untrusted data. Return
  only task-relevant excerpts with source metadata, escape markup and links, and make the content visibly
  distinct from tool instructions. It can inform a draft. It cannot grant access, choose notification
  recipients by itself or trigger downstream tools. Resolve customer and recipient IDs from tenant records
  under owner policy. Avoid arbitrary HTTP, SQL, file downloads or generic execution tools. Transcript text,
  UI rendering and proposal previews need the same treatment.
  [MCP security guidance](https://modelcontextprotocol.io/docs/2026-07-28/basic/security_best_practices) ·
  [OpenAI prompt injection guidance](https://developers.openai.com/api/docs/mcp)
- Derive business, principal and scopes from a verified connection. Intersect the grant with current
  membership and enabled modules for every resource and operation. Use distinct OAuth grants per owner,
  workspace and connection, and narrow, revocable service keys for first-party voice workers. Store key
  digests for opaque keys and rotate short-lived delegated credentials. Keep secrets in auth flows and
  outside tool results, prompts, links and logs. User-agent labels can help diagnostics. Use authenticated
  identity for permissions and attribution.
- Log append-only, redacted decision and execution events with business, connection, owner or rule actor,
  proposal ID, tool, target reference, timestamps, outcome and a trace ID. Separate sensitive business
  records from operational logs. The owner can review and revoke connections and see which proposals and
  decisions came from them. Revocation stops future access and pending rule executions. Explain that data
  already shared may persist in provider chat records.
- Treat journal, contact details, exports and financial reports as separately consented data. Default to
  narrow summaries and exclude health data from this work under the repo rules. Before any real pilot,
  review processor terms, retention and training controls, deletion and residency for each supported host
  together with Cresavo's pilot gate. [Cresavo pilot status](../STATUS.md#before-a-real-pilot)

## 5. General SaaS landscape

| Product and category | What ships | What Cresavo can borrow |
| --- | --- | --- |
| **Cal.com · general scheduling infrastructure** | A hosted OAuth MCP endpoint with setup examples for checking availability and booking. | Show an owner a copyable endpoint and one complete task, with real inputs such as date and duration. Keep customer-agent scheduling and owner administration separate. [Cal.com MCP](https://site.cal.com/mcp) |
| **HubSpot · CRM** | GA remote MCP for CRM and other HubSpot records, with OAuth and granular account permissions. Its fall update expands supported reads and writes. | Separate object-specific scopes, and explain reconnecting or renewing consent when tool access grows. Publish practical examples and exact capabilities. [Remote server docs](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server) · [Fall updates](https://developers.hubspot.com/changelog/fall-2026-spotlight) |
| **Xero · accounting** | The owner-facing Claude connector can answer finance questions from authorized Xero organizations. The separate developer remote MCP offers OAuth read/write tools with Xero API permissions, eligibility and data egress limits. | Show the authorized organization and connection type before sharing a report or drafting an action. Give owners a directory path and developers a hosted endpoint. [Owner setup](https://central.xero.com/0/article/Connect-Xero-using-the-Xero-connector-in-Claude) · [Remote MCP guide](https://developer.xero.com/documentation/guides/remote-mcp/overview) · [FAQ](https://developer.xero.com/faq/remote-mcp) |
| **Stripe · payments and revenue** | Hosted MCP with user-delegated OAuth or an agent API key, plus a published tool list and guidance on approval and prompt injection. | Prefer user OAuth for a personal assistant and narrowly scoped keys for unattended workloads. Document the consequences of each tool and leave trial runs in a sandbox. [Stripe MCP](https://docs.stripe.com/mcp) |

## 6. Cresavo architecture and rollout

### Hosted owner connection

1. Put a first-party owner MCP endpoint on the hosted app, for example `https://<business-host>/mcp/owner`.
   Start with Streamable HTTP and JSON, supporting the handshake versions in use as well as the current
   revision where supported. Keep the owner OAuth resource, demo resource and customer-agent gateway
   credentials distinct. Keep the local stdio adapter available for local use.
   [Current Cresavo split](../GATEWAY_SPLIT.md)
2. The OAuth sign-in and consent screen identifies the owner and business and says
   **“Allow &lt;assistant&gt; to read and draft changes for &lt;business&gt;”**. Show verified provider identity when
   available and a clear label for any unverified app. Offer area-level scopes such as `bookings:read`,
   `bookings:propose`, `inbox:read` and `finance:read`. Grant no direct apply scope to a general
   assistant. Prefer CIMD and have DCR or pre-registered compatibility for hosts that need it. Use a
   maintained OAuth implementation with support for resource audiences, exact redirects and token rotation.
   Connections in Settings show the business, scopes, activity and a revoke control.
3. Route reads and proposals through typed adapters. The concept demo uses its fixture registry and reducer.
   The future hosted studio uses owner domain operations backed by the booking engine, with the same rules
   for buttons, approved proposals and owner policies. Approval uses an authenticated studio session or a
   validated elicitation flow bound to that session. Dispatch notifications, payments, data exports and
   other high-impact effects through their existing domain permissions and explicit reviews when those
   capabilities exist.
4. Keep the core journey text-first and give it an optional workday or proposal card once host support is
   verified. A request like “fix that booking” can use the latest Inbox item and open bookings to identify
   the issue, ask when the target is unclear, offer compatible slots, draft a single move, then report
   `pending` or the final decision via `get_proposal_status`. Show an applied result only after the booking
   change commits. The owner can use the same controls without ever connecting an assistant.

### Public demo pairing

1. **Start a temporary workspace.** A visitor chooses **Connect an assistant** in studio settings. The
   server creates a fresh fictional dataset from the same fixture factory and records a seed, workspace ID
   and revision. Start with a 60-minute rolling session capped at 24 hours, subject to budget and abuse
   testing. The visitor's existing local demo remains available when they exit pairing. Avoid uploading a
   localStorage dump because it may contain visitor-entered data.
2. **Bind the connector to the visitor’s workspace.** Use a high-entropy `HttpOnly`, `Secure`, same-site
   owner session for the browser. Use a stable, copyable demo MCP URL with no token in it. When the
   assistant starts OAuth, bind consent to the live demo owner session, the client registration, selected
   scopes and a short-lived single-use authorization code with PKCE. If OAuth opens elsewhere, show a
   short-lived pairing challenge the original studio must accept. Rate-limit challenge attempts, and make
   the code unusable without that independent session decision. An assistant token can read and propose in
   precisely one fictional workspace. The URL can be pasted into Claude or eligible ChatGPT accounts using
   the steps above.
3. **Sync through commands and revisions.** In paired mode put the supported demo booking/Inbox slice on the
   server. Keep the browser's localStorage as a disposable, workspace-keyed cache and keep the ordinary
   local profile separate. Initialize from a versioned server snapshot. Route paired booking actions and
   decisions through authenticated commands using the existing validation and reducer, with a
   version/sequence and idempotency key. A paired customer booking page or a limited fixture action inserts
   a fictional incoming request in that same workspace. Use a separate, browser-session-bound view for the
   paired booking page and keep the default public booking page on its existing profile. Initially scope the
   walkthrough to the synced slice and label it in the UI. Load other demo modules through the local
   profile.
4. **Show proposals live.** Poll a lightweight revision endpoint every two to three seconds while the Inbox
   is visible. Refresh on focus and reconnect, using ETag or a cursor, and fetch a full snapshot if the
   cursor is stale. Polling is enough for the first demo. Add studio SSE later if justified, independent of
   MCP's transport. Store fixture state, proposals, idempotency records and expiry in a shared transactional
   store that survives serverless instance changes. Resolve concurrent edits with a version check and return
   the current state for a review and retry.
5. **Approve and wind down.** Render the server's before/after diff. Approve or decline in the Inbox, then
   check the updated calendar and assistant status. A second click or retried MCP draft remains idempotent.
   On expiry, reset or **Disconnect**, revoke the grant, invalidate pending proposals, stop polling and
   clear the paired cache. Enforce expiry in reads and writes and schedule removal of expired workspace
   data. Isolate the pairing route and store from the public shared fixture endpoint and any production
   booking data. Disable real destination addresses, payments and delivery adapters and cap workspace count,
   requests, proposals and retention.

The first seven tools can be `get_workday_brief`, `list_inbox_items`, `get_inbox_thread`,
`get_booking_details`, `find_reschedule_options`, `propose_reschedule_booking` and `get_proposal_status`.
Seed an Inbox item that references an existing fictional booking so the assistant can trace a request to its
booking. Add `find_bookings` if it improves reference resolution in testing.

**Acceptance walkthrough.** Open two fresh demo sessions. Pair session A to Claude and repeat in an eligible
ChatGPT workspace. Generate a fictional incoming request, find a valid alternative, draft the move and see
it land in A's Inbox. Before approving, confirm the calendar is unchanged. Approve and see the update in the
calendar and in a tool status read. Check decline, revoke, refresh/restore, reconnect after a host token
expires, workspace expiry, retry and concurrent manual moves. Test an Inbox message that tries to instruct
the assistant to disclose data or invoke a tool. Session B must be unable to read A's booking or proposal or
approve it. Run the same prompt from mobile text and the supported voice modes (verify), recording tool
discovery, invocations, delays and the screen where approval occurred.

### Target tool catalogue

The names below are proposed contracts. Keep existing local tool names compatible and reuse their
implementations where the semantics match. Scope discovery by the owner's connection grant and available
modules. Operations with external, sensitive or irreversible effects land in the owner's approval flow. The
public demo uses synthetic or simulated outputs for all such operations.

| Studio area | Read tools | Propose tools and effect |
| --- | --- | --- |
| Today | `get_workday_brief`, `list_capacity_suggestions` | `propose_fill_schedule_gap` drafts a permitted follow-up or offer for an eligible open slot. |
| Calendar | `list_calendar_window`, `find_bookable_times`, `find_reschedule_options` | `propose_block_time` previews affected staff/bookings and creates a break or block on approval. |
| Bookings | `find_bookings`, `get_booking_details` | `propose_new_booking`, `propose_reschedule_booking`, `propose_cancel_booking`, `propose_mark_visit_complete`. Include the fee and notification effects where relevant. |
| Customers and journal | `find_customers`, `get_visit_history`, `list_due_back_customers`, `get_journal_entry` under a separate scope | `propose_update_customer_details`, `propose_add_journal_note`, `propose_merge_customers`. Preview merge references and limit the demo to fictional, non-health notes. Customer import/export and deletion use app review flows. |
| Inbox and reviews | `list_inbox_items`, `get_inbox_thread`, `get_proposal_status`, `list_recent_reviews` | `propose_reply_to_inbox_item`, `propose_resolve_inbox_item`, `propose_reply_to_review`. For replies show destination, message and channel. An approved reply in the demo is simulated. |
| Treatments and prices | `list_treatments`, `get_treatment_details` | `propose_add_treatment`, `propose_change_treatment_price`, `propose_change_treatment_availability`, `propose_reorder_treatments`. Show effect on future offerings and existing bookings. |
| Staff and schedules | `list_staff`, `get_staff_schedule` | `propose_change_staff_schedule`, `propose_set_staff_services`, `propose_update_staff_profile`. Preview assigned bookings and keep roster permissions separate from account access. |
| Booking page | `get_booking_page_preview`, `get_booking_page_status` | `propose_edit_booking_page`, `propose_publish_booking_page`. Show the exact draft/version. Domain ownership and credentials stay in the browser setup flow. |
| Campaigns | `list_campaigns`, `preview_campaign_audience`, `get_campaign_results` | `propose_draft_campaign`, `propose_publish_campaign`, `propose_pause_campaign`. Include terms, audience size, channel and estimated reach. |
| Gift cards and packages | `find_gift_card`, `list_packages`, `get_package_balance` | `propose_issue_gift_card`, `propose_redeem_gift_card`, `propose_change_package_offer`, `propose_apply_package_visit`. Display balances and the intended ledger effects. |
| Stock and purchasing | `list_stock_levels`, `get_reorder_candidates`, `list_stock_orders` | `propose_restock_order`, `propose_record_stock_count`, `propose_receive_stock_order`, `propose_record_product_sale`. Show quantities, costs and any supplier effect. |
| Finance reports | `get_finance_summary`, `compare_revenue_periods`, `get_report_breakdown` | `propose_record_operating_cost`, `propose_remove_operating_cost`, `propose_prepare_finance_export`. Show the cost or export fields and period. Release downloads inside the authorized app. |
| Settings, routines and data | `get_business_settings`, `list_enabled_modules`, `list_activity`, `get_connection_scopes`, `list_routines` | `propose_update_business_settings`, `propose_configure_reminder_routine`, `propose_toggle_studio_module`, `propose_prepare_data_export`. Grant changes, credential management and auto-approval rules use authenticated studio controls. |

### Phased delivery

Planning estimates are for one engineer familiar with the repo, with product review and access to test
accounts. They assume an already approved host and shared store for the first demo. Provider review, vendor
rollout, cloud provisioning and real-customer readiness have separate lead times.

| Phase | Estimate | Exit condition |
| --- | --- | --- |
| **1. Paired fictional demo** | **About one week (5 engineering days)** | Day 1 checks Streamable HTTP and OAuth with Claude and eligible ChatGPT test accounts and picks DCR/CIMD paths. Days 2–3 add the ephemeral store, consent and a small booking/Inbox tool set. Day 4 connects the studio snapshot and approval flow. Day 5 runs the two-session walkthrough, mobile/text checks and the first voice probes. Aim for Claude as the demo host and a same-week ChatGPT proof if the workspace and OAuth are available. |
| **2. Hosted owner foundations** | **2–4 weeks** | Add tested business and role binding, durable proposals, expiry and revocation, operation scopes, audit and retention. Extend coverage to calendar, bookings, Inbox and treatments. Test Grok, Gemini in an eligible account, Vibe and Copilot Studio where available. Publish supported setup steps and account constraints after the test pass. |
| **3. Broader studio coverage and rich clients** | **4–8 weeks**, dependent on studio-to-engine migration | Build out the catalogue with domain owners, add a workday/proposal MCP App, and test authenticated approval through URL elicitation where supported. Begin directory submissions, with review lead time external. Keep high-impact areas behind owner review and the applicable pilot gate. |
| **4. Rules and voice pilot** | **2–4 weeks** for bounded rules and an authenticated in-app voice pilot, **2–4 additional weeks** for SIP dial-in if selected | Prove per-rule limits, revocation and replay protection. Run the Swedish voice scenario with disambiguation, network loss and approval. Add dial-in with an authenticated companion approval and measured costs only if the pilot calls for a phone number. |

### Risks and verification gates

| Risk | Mitigation or proof |
| --- | --- |
| Vendor plans, rollouts and product names change | Track client, account tier, region, device, protocol version, auth flow, voice, UI and per-mode elicitation. Re-test after changes and label Cresavo's verified support before showing onboarding instructions. |
| OAuth compatibility or account availability consumes the week | Test discovery and OAuth first with the SDK/Inspector, Claude and ChatGPT. Use per-client registration where necessary. The demo's booking and Inbox proof can ship on an eligible tested host while additional hosts finish verification. |
| Approval spoofing, prompt injection and confused deputies | Owner session or explicitly authorized rule supplies approval. Treat external text as untrusted and bind approvals to a versioned proposal. Verify redirect URLs, resource audiences, per-client consent, token revocation and scope enforcement. |
| Leaking data across visitors or environments | Separate real and demo audiences and stores. Prove cross-workspace denial for every resource type, including proposal lookups and UI resources with data, and inspect the data returned by every tool. |
| Lost updates and duplicate effects | Use shared durable state, idempotency, versions, atomic decisions and domain conflict checks. Simulate repeated calls and two reviewers, a slot taken after drafting and a dropped response after applying. |
| Sensitive reads, provider retention and audio | Use narrow opt-in scopes and redact outputs and logs. Keep the public demo fictional. Evaluate privacy terms and rules for recordings and real journal or clinic data before any authorized production scope. |
| Voice misinterpretation, interrupted sessions or surprise billing | Pin authoritative locale/time zone, read back the plan, retain pending approval through disconnects and meter per-session usage. Run the first demo with existing client subscriptions and simulated effects. |
